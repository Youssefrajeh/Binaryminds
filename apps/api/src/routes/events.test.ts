import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signToken } from "../lib/jwt.js";
import { prisma as client } from "../lib/prisma.js";
import type { PrismaMock } from "../test/prismaMock.js";

vi.mock("../lib/prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});
const prisma = client as unknown as PrismaMock;
const app = createApp();
// Intentionally stale: promotions must work without replacing the JWT.
const auth = `Bearer ${signToken({ userId: "org", role: "STUDENT" })}`;
const body = {
  title: "Games night",
  description: "Board games",
  location: "Forwell Hall",
  startsAt: "2099-01-01T18:00:00Z",
  endsAt: "2099-01-01T20:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  prisma.user.count.mockResolvedValue(1);
  prisma.user.findUnique.mockResolvedValue({
    role: "ORGANIZER",
    status: "ACTIVE",
  });
});

describe("event browsing", () => {
  it("requires a verified active session", async () => {
    expect((await request(app).get("/api/events")).status).toBe(401);
    prisma.user.count.mockResolvedValueOnce(0);
    expect(
      (await request(app).get("/api/events").set("Authorization", auth)).status,
    ).toBe(401);
  });
  it("queries only future published events with stable date ordering and public organizer fields", async () => {
    prisma.event.findMany.mockResolvedValue([]);
    const response = await request(app)
      .get("/api/events")
      .set("Authorization", auth);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
    expect(response.headers["x-has-more"]).toBe("false");
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED", startsAt: { gt: expect.any(Date) } },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
        include: expect.objectContaining({
          organizer: {
            select: {
              id: true,
              profile: { select: { displayName: true, avatarUrl: true } },
            },
          },
        }),
      }),
    );
  });
  it("pages upcoming events", async () => {
    prisma.event.findMany.mockResolvedValue([
      { id: "1" },
      { id: "2" },
      { id: "3" },
    ]);
    const response = await request(app)
      .get("/api/events?page=2&limit=2")
      .set("Authorization", auth);
    expect(response.body).toHaveLength(2);
    expect(response.headers["x-has-more"]).toBe("true");
    expect(prisma.event.findMany.mock.calls[0][0]).toMatchObject({
      skip: 2,
      take: 3,
    });
  });
  it.each(["page=0", "limit=51", "page=1.5"])(
    "rejects malformed pagination %s",
    async (query) => {
      expect(
        (
          await request(app)
            .get(`/api/events?${query}`)
            .set("Authorization", auth)
        ).status,
      ).toBe(400);
    },
  );
  it("does not reveal someone else's draft or cancelled event", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: "e1",
      organizerId: "other",
      status: "DRAFT",
    });
    expect(
      (await request(app).get("/api/events/e1").set("Authorization", auth))
        .status,
    ).toBe(404);
  });
});

describe("student RSVPs and saved events", () => {
  it.each(["post", "delete", "get"] as const)("requires authentication for %s", async (method) => {
    const path = method === "get" ? "/api/events/saved" : "/api/events/e1/rsvp";
    expect((await request(app)[method](path)).status).toBe(401);
  });

  it("saves only the signed-in user's RSVP and makes repeat requests idempotent", async () => {
    prisma.event.findUnique.mockResolvedValue({ id: "e1", status: "PUBLISHED", startsAt: new Date(body.startsAt) });
    prisma.rsvp.upsert.mockResolvedValue({ id: "r1" });
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await request(app).post("/api/events/e1/rsvp").set("Authorization", auth).send({ userId: "someone-else" });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ isRsvped: true });
    }
    expect(prisma.rsvp.upsert).toHaveBeenCalledWith({
      where: { eventId_userId: { eventId: "e1", userId: "org" } },
      create: { eventId: "e1", userId: "org" }, update: {},
    });
  });

  it.each([
    [null, 404],
    [{ status: "DRAFT", startsAt: new Date(body.startsAt) }, 404],
    [{ status: "CANCELLED", startsAt: new Date(body.startsAt) }, 409],
    [{ status: "PUBLISHED", startsAt: new Date("2020-01-01") }, 409],
  ])("rejects unavailable events: %j", async (event, status) => {
    prisma.event.findUnique.mockResolvedValue(event);
    expect((await request(app).post("/api/events/e1/rsvp").set("Authorization", auth)).status).toBe(status);
    expect(prisma.rsvp.upsert).not.toHaveBeenCalled();
  });

  it("treats concurrent duplicate RSVPs as success", async () => {
    prisma.event.findUnique.mockResolvedValue({ id: "e1", status: "PUBLISHED", startsAt: new Date(body.startsAt) });
    prisma.rsvp.upsert.mockRejectedValue({ code: "P2002" });
    expect((await request(app).post("/api/events/e1/rsvp").set("Authorization", auth)).body).toEqual({ isRsvped: true });
  });

  it("cancels only the caller's RSVP, even for cancelled/past events or a repeat cancellation", async () => {
    prisma.rsvp.deleteMany.mockResolvedValue({ count: 0 });
    expect((await request(app).delete("/api/events/e1/rsvp").set("Authorization", auth).send({ userId: "other" })).status).toBe(204);
    expect(prisma.rsvp.deleteMany).toHaveBeenCalledWith({ where: { eventId: "e1", userId: "org" } });
  });

  it("loads only the caller's saved events and hides drafts with bounded pagination", async () => {
    prisma.event.findMany.mockResolvedValue([{ id: "e1" }, { id: "e2" }, { id: "extra" }]);
    const response = await request(app).get("/api/events/saved?page=2&limit=2&userId=other").set("Authorization", auth);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "e1", isRsvped: true }, { id: "e2", isRsvped: true }]);
    expect(response.headers["x-has-more"]).toBe("true");
    expect(prisma.event.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { rsvps: { some: { userId: "org" } }, status: { in: ["PUBLISHED", "CANCELLED"] } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }], skip: 2, take: 3,
    }));
  });

  it("rejects invalid saved-events pagination", async () => {
    expect((await request(app).get("/api/events/saved?limit=1000").set("Authorization", auth)).status).toBe(400);
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it("includes private attendance state without exposing RSVP rows", async () => {
    prisma.event.findMany.mockResolvedValue([{ id: "e1", rsvps: [{ id: "r1" }] }, { id: "e2", rsvps: [] }]);
    const response = await request(app).get("/api/events").set("Authorization", auth);
    expect(response.body).toEqual([{ id: "e1", isRsvped: true }, { id: "e2", isRsvped: false }]);
    expect(prisma.event.findMany.mock.calls[0][0].include.rsvps).toEqual({ where: { userId: "org" }, select: { id: true } });
  });
});

describe("organizer actions", () => {
  it.each(["post", "put", "patch", "get"] as const)(
    "rejects a student for privileged %s despite an Organizer JWT",
    async (method) => {
      prisma.user.findUnique.mockResolvedValue({
        role: "STUDENT",
        status: "ACTIVE",
      });
      const staleToken = `Bearer ${signToken({ userId: "org", role: "ORGANIZER" })}`;
      const path =
        method === "post"
          ? "/api/events"
          : method === "put"
            ? "/api/events/e1"
            : method === "get"
              ? "/api/events/mine"
              : "/api/events/e1/cancel";
      expect(
        (
          await request(app)
            [method](path)
            .set("Authorization", staleToken)
            .send(body)
        ).status,
      ).toBe(403);
      expect(prisma.event.create).not.toHaveBeenCalled();
    },
  );
  it("creates a published event after promotion using an old Student JWT", async () => {
    prisma.event.create.mockResolvedValue({ id: "e1", status: "PUBLISHED" });
    const response = await request(app)
      .post("/api/events")
      .set("Authorization", auth)
      .send({ ...body, organizerId: "other", status: "DRAFT" });
    expect(response.status).toBe(201);
    expect(prisma.event.create.mock.calls[0][0].data).toEqual({
      ...body,
      startsAt: new Date(body.startsAt),
      endsAt: new Date(body.endsAt),
      endDate: null,
      organizerId: "org",
      status: "PUBLISHED",
    });
  });
  it.each([
    { title: " " },
    { description: " " },
    { location: " " },
    { title: "x".repeat(121) },
    { startsAt: "2020-01-01T18:00:00Z" },
    { endsAt: "2099-01-01T17:00:00Z" },
    { startsAt: "not a date" },
    { endDate: "2098-12-31" },
    { endDate: "2099-02-30" },
    { endDate: "2099-01-02" },
    { imageUrl: "data:image/png;base64,YmFk" },
    { imageUrl: "https://example.com/image.svg" },
  ])("validates input on the server: %j", async (patch) => {
    expect(
      (
        await request(app)
          .post("/api/events")
          .set("Authorization", auth)
          .send({ ...body, ...patch })
      ).status,
    ).toBe(400);
    expect(prisma.event.create).not.toHaveBeenCalled();
  });
  it("lists only the authenticated organizer's events including cancelled ones", async () => {
    prisma.event.findMany.mockResolvedValue([]);
    await request(app).get("/api/events/mine").set("Authorization", auth);
    expect(prisma.event.findMany.mock.calls[0][0].where).toEqual({
      organizerId: "org",
    });
  });
  it.each([
    { endsAt: undefined, endDate: undefined },
    { endsAt: null, endDate: null },
    { endsAt: null, endDate: "2099-01-20" },
    { endsAt: "2099-01-20T12:00:00Z", endDate: "2099-01-20" },
    { startsAt: "2099-01-01T23:00:00-05:00", endsAt: null, endDate: "2099-01-01" },
  ])("accepts independent optional end fields: %j", async (fields) => {
    prisma.event.create.mockResolvedValue({ id: "e1" });
    const response = await request(app).post("/api/events").set("Authorization", auth).send({ ...body, ...fields });
    expect(response.status).toBe(201);
    expect(prisma.event.create.mock.calls[0][0].data.endsAt).toEqual(fields.endsAt ? new Date(fields.endsAt) : null);
  });
  it("accepts a real photo and clears optional fields on edit", async () => {
    const imageUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=";
    prisma.event.create.mockResolvedValue({ id: "e1" });
    expect((await request(app).post("/api/events").set("Authorization", auth).send({ ...body, imageUrl })).status).toBe(201);
    expect(prisma.event.create.mock.calls[0][0].data.imageUrl).toBe(imageUrl);
    prisma.event.findUnique.mockResolvedValue({ id: "e1", organizerId: "org", status: "PUBLISHED", startsAt: new Date(body.startsAt) });
    prisma.event.updateMany.mockResolvedValue({ count: 1 });
    prisma.event.findUniqueOrThrow.mockResolvedValue({ id: "e1" });
    expect((await request(app).put("/api/events/e1").set("Authorization", auth).send({ ...body, endsAt: null, endDate: null, imageUrl: null })).status).toBe(200);
    expect(prisma.event.updateMany.mock.calls[0][0].data).toMatchObject({ endsAt: null, endDate: null, imageUrl: null });
  });
  it.each(["put", "patch"] as const)(
    "prevents %s against another organizer's event",
    async (method) => {
      prisma.event.findUnique.mockResolvedValue({
        id: "e1",
        organizerId: "other",
        status: "PUBLISHED",
      });
      const path =
        method === "put" ? "/api/events/e1" : "/api/events/e1/cancel";
      expect(
        (await request(app)[method](path).set("Authorization", auth).send(body))
          .status,
      ).toBe(403);
      expect(prisma.event.update).not.toHaveBeenCalled();
      expect(prisma.event.updateMany).not.toHaveBeenCalled();
    },
  );
  it("saves edits without changing event ownership", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: "e1",
      organizerId: "org",
      status: "PUBLISHED",
      startsAt: new Date(body.startsAt),
    });
    prisma.event.updateMany.mockResolvedValue({ count: 1 });
    prisma.event.findUniqueOrThrow.mockResolvedValue({
      id: "e1",
      title: body.title,
    });
    expect(
      (
        await request(app)
          .put("/api/events/e1")
          .set("Authorization", auth)
          .send(body)
      ).status,
    ).toBe(200);
    expect(prisma.event.updateMany.mock.calls[0][0].data).not.toHaveProperty(
      "organizerId",
    );
  });
  it("lets the organizer fix the details of an event that has already started", async () => {
    const startedAt = new Date(Date.now() - 3_600_000);
    prisma.event.findUnique.mockResolvedValue({ id: "e1", organizerId: "org", status: "PUBLISHED", startsAt: startedAt });
    prisma.event.updateMany.mockResolvedValue({ count: 1 });
    prisma.event.findUniqueOrThrow.mockResolvedValue({ id: "e1" });

    const res = await request(app).put("/api/events/e1").set("Authorization", auth)
      .send({ ...body, description: "Room changed to SC1001", startsAt: startedAt.toISOString(), endsAt: null, endDate: null });

    expect(res.status).toBe(200);
    expect(prisma.event.updateMany.mock.calls[0][0].data.description).toBe("Room changed to SC1001");
  });
  it("still refuses to move an event's start into the past", async () => {
    prisma.event.findUnique.mockResolvedValue({ id: "e1", organizerId: "org", status: "PUBLISHED", startsAt: new Date(body.startsAt) });

    const res = await request(app).put("/api/events/e1").set("Authorization", auth)
      .send({ ...body, startsAt: "2020-01-01T18:00:00Z", endsAt: null, endDate: null });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("The event must start in the future");
    expect(prisma.event.updateMany).not.toHaveBeenCalled();
  });
  it("refuses edits to cancelled events", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: "e1",
      organizerId: "org",
      status: "CANCELLED",
      startsAt: new Date(body.startsAt),
    });
    prisma.event.updateMany.mockResolvedValue({ count: 0 });
    expect(
      (
        await request(app)
          .put("/api/events/e1")
          .set("Authorization", auth)
          .send(body)
      ).status,
    ).toBe(409);
  });
  it("persists a cancellation", async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: "e1",
      organizerId: "org",
      status: "PUBLISHED",
    });
    prisma.event.update.mockResolvedValue({ id: "e1", status: "CANCELLED" });
    const response = await request(app)
      .patch("/api/events/e1/cancel")
      .set("Authorization", auth);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("CANCELLED");
  });
  it.each(["put", "patch"] as const)(
    "returns 404 for a missing event on %s",
    async (method) => {
      prisma.event.findUnique.mockResolvedValue(null);
      expect(
        (
          await request(app)
            [method](
              `/api/events/missing${method === "patch" ? "/cancel" : ""}`,
            )
            .set("Authorization", auth)
            .send(body)
        ).status,
      ).toBe(404);
    },
  );
});
