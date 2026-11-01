import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { MAX_LOST_FOUND_PHOTO_BYTES } from "@campushub/shared";
import type { PrismaMock } from "../test/prismaMock.js";
import { prisma as prismaClient } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { createApp } from "../app.js";

vi.mock("../lib/prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});

const prisma = prismaClient as unknown as PrismaMock;
const app = createApp();
let auth: string;
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=";
const validBody = {
  kind: "LOST", title: " Blue backpack ", description: " Left after class ",
  category: "BAGS", location: " Library, second floor ", occurredOn: "2026-10-01", imageUrl: image,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-28T15:00:00Z"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  auth = `Bearer ${signToken({ userId: "alice", role: "STUDENT" })}`;
});
afterEach(() => vi.restoreAllMocks());

describe("Lost & Found authorization", () => {
  it.each(["get", "post", "patch"] as const)("requires authentication for %s", async (method) => {
    const url = method === "patch" ? "/api/lost-found/p1/resolve" : "/api/lost-found";
    expect((await request(app)[method](url)).status).toBe(401);
  });

  it("rejects suspended accounts even with a valid token", async () => {
    prisma.user.count.mockResolvedValueOnce(0);
    const response = await request(app).post("/api/lost-found").set("Authorization", auth).send(validBody);
    expect(response.status).toBe(401);
    expect(prisma.lostFoundPost.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/lost-found", () => {
  it.each(["LOST", "FOUND"])("creates a %s report with a photo and the authenticated owner", async (kind) => {
    prisma.lostFoundPost.create.mockResolvedValue({ id: "p1", ...validBody, kind, authorId: "alice", status: "OPEN" });
    const response = await request(app).post("/api/lost-found").set("Authorization", auth)
      .send({ ...validBody, kind, authorId: "attacker", status: "RESOLVED" });
    expect(response.status).toBe(201);
    expect(response.body.id).toBe("p1");
    expect(prisma.lostFoundPost.create).toHaveBeenCalledWith({
      data: { ...validBody, title: "Blue backpack", description: "Left after class", location: "Library, second floor",
        kind, authorId: "alice", status: "OPEN", occurredOn: new Date("2026-10-01T00:00:00.000Z") },
      include: { author: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } } },
    });
  });

  it("allows a report without a photo", async () => {
    prisma.lostFoundPost.create.mockResolvedValue({ id: "p1" });
    const { imageUrl: _image, ...body } = validBody;
    expect((await request(app).post("/api/lost-found").set("Authorization", auth).send(body)).status).toBe(201);
    expect(prisma.lostFoundPost.create.mock.calls[0][0].data.imageUrl).toBeNull();
  });

  it.each([
    ["blank title", { title: "   " }],
    ["long title", { title: "x".repeat(101) }],
    ["blank description", { description: " " }],
    ["long description", { description: "x".repeat(2001) }],
    ["missing category", { category: undefined }],
    ["unknown category", { category: "WALLETS" }],
    ["invalid kind", { kind: "MISSING" }],
    ["blank location", { location: " " }],
    ["long location", { location: "x".repeat(121) }],
    ["missing date", { occurredOn: undefined }],
    ["impossible date", { occurredOn: "2026-02-30" }],
    ["datetime instead of date", { occurredOn: "2026-10-01T00:00:00Z" }],
    ["future date", { occurredOn: "2026-10-29" }],
    ["remote image", { imageUrl: "https://example.com/photo.png" }],
    ["malformed base64", { imageUrl: "data:image/png;base64,@@@@" }],
    ["mislabeled file", { imageUrl: `data:image/png;base64,${Buffer.from("not a photo").toString("base64")}` }],
    ["SVG image", { imageUrl: `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}` }],
  ])("rejects %s before writing", async (_name, patch) => {
    const response = await request(app).post("/api/lost-found").set("Authorization", auth).send({ ...validBody, ...patch });
    expect(response.status).toBe(400);
    expect(response.body.error).toBeTypeOf("string");
    expect(response.body.details).toBeDefined();
    expect(prisma.lostFoundPost.create).not.toHaveBeenCalled();
  });

  it("checks decoded photo bytes at the 2 MB limit", async () => {
    const bytes = Buffer.alloc(MAX_LOST_FOUND_PHOTO_BYTES + 1);
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
    const response = await request(app).post("/api/lost-found").set("Authorization", auth)
      .send({ ...validBody, imageUrl: `data:image/png;base64,${bytes.toString("base64")}` });
    expect(response.status).toBe(400);
    expect(prisma.lostFoundPost.create).not.toHaveBeenCalled();
  });

  it("uses Toronto's date when UTC is already tomorrow", async () => {
    vi.mocked(Date.now).mockReturnValue(Date.parse("2026-10-29T01:00:00Z"));
    auth = `Bearer ${signToken({ userId: "alice", role: "STUDENT" })}`;
    const response = await request(app).post("/api/lost-found").set("Authorization", auth)
      .send({ ...validBody, occurredOn: "2026-10-29" });
    expect(response.status).toBe(400);
  });

  it("returns a useful error if persistence fails", async () => {
    prisma.lostFoundPost.create.mockRejectedValueOnce(new Error("Database unavailable"));
    const response = await request(app).post("/api/lost-found").set("Authorization", auth).send(validBody);
    expect(response.status).toBe(500);
    expect(response.body.error).toContain("Could not create");
  });
});

describe("GET /api/lost-found", () => {
  const visible = { OR: [{ removedAt: null }, { removedAt: { isSet: false } }] };
  beforeEach(() => prisma.lostFoundPost.findMany.mockResolvedValue([]));

  it("combines keyword, kind, category, location and inclusive dates", async () => {
    const response = await request(app).get("/api/lost-found").set("Authorization", auth)
      .query({ search: " blue ", kind: "LOST", category: "BAGS", location: " library ", from: "2026-10-01", to: "2026-10-03" });
    expect(response.status).toBe(200);
    expect(prisma.lostFoundPost.findMany.mock.calls[0][0].where).toEqual({
      kind: "LOST", category: "BAGS", location: { contains: "library", mode: "insensitive" },
      AND: [visible, { OR: [
        { title: { contains: "blue", mode: "insensitive" } },
        { description: { contains: "blue", mode: "insensitive" } },
      ] }],
      occurredOn: { gte: new Date("2026-10-01T00:00:00Z"), lt: new Date("2026-10-04T00:00:00Z") },
    });
  });

  it.each([
    [{ category: "KEYS" }, { category: "KEYS" }],
    [{ location: "Library" }, { location: { contains: "Library", mode: "insensitive" } }],
    [{ from: "2026-10-01" }, { occurredOn: { gte: new Date("2026-10-01T00:00:00Z") } }],
    [{ to: "2026-10-01" }, { occurredOn: { lt: new Date("2026-10-02T00:00:00Z") } }],
  ])("supports filters independently: %j", async (query, where) => {
    expect((await request(app).get("/api/lost-found").set("Authorization", auth).query(query)).status).toBe(200);
    expect(prisma.lostFoundPost.findMany.mock.calls[0][0].where).toEqual({ ...where, AND: [visible] });
  });

  it("keeps legacy uncategorized reports in Other when also searching", async () => {
    await request(app).get("/api/lost-found?category=OTHER&search=wallet").set("Authorization", auth);
    const where = prisma.lostFoundPost.findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([{ category: "OTHER" }, { category: null }, { category: { isSet: false } }]);
    expect(where.AND).toHaveLength(2);
    expect(where.AND[0]).toEqual(visible);
  });

  it("bounds pages and uses stable newest-first ordering", async () => {
    prisma.lostFoundPost.findMany.mockResolvedValue([{ id: "p3" }, { id: "p2" }, { id: "p1" }]);
    const response = await request(app).get("/api/lost-found?page=2&limit=2").set("Authorization", auth);
    expect(response.body.map((post: { id: string }) => post.id)).toEqual(["p3", "p2"]);
    expect(response.headers["x-has-more"]).toBe("true");
    expect(response.headers["access-control-expose-headers"]).toContain("X-Has-More");
    expect(prisma.lostFoundPost.findMany.mock.calls[0][0]).toMatchObject({
      skip: 2, take: 3, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  });

  it("returns an empty array and no next page for no matches", async () => {
    const response = await request(app).get("/api/lost-found?category=KEYS").set("Authorization", auth);
    expect(response.body).toEqual([]);
    expect(response.headers["x-has-more"]).toBe("false");
  });

  it.each([
    { category: "INVALID" }, { kind: "INVALID" }, { from: "2026-02-30" },
    { to: "yesterday" }, { from: "2026-10-02", to: "2026-10-01" },
    { page: "0" }, { page: "1.5" }, { page: "10001" }, { limit: "51" },
    { location: "x".repeat(121) }, { search: "x".repeat(101) }, { category: ["KEYS", "BAGS"] },
  ])("rejects malformed filters: %j", async (query) => {
    const response = await request(app).get("/api/lost-found").set("Authorization", auth).query(query);
    expect(response.status).toBe(400);
    expect(prisma.lostFoundPost.findMany).not.toHaveBeenCalled();
  });
});

describe("existing resolve action", () => {
  it("returns 404 for a missing post", async () => {
    prisma.lostFoundPost.findUnique.mockResolvedValueOnce(null);
    expect((await request(app).patch("/api/lost-found/missing/resolve").set("Authorization", auth)).status).toBe(404);
  });

  it("prevents resolving another student's report", async () => {
    prisma.lostFoundPost.findUnique.mockResolvedValueOnce({ id: "p1", authorId: "bob" });
    expect((await request(app).patch("/api/lost-found/p1/resolve").set("Authorization", auth)).status).toBe(403);
    expect(prisma.lostFoundPost.update).not.toHaveBeenCalled();
  });

  it("lets the owner persist the resolved status", async () => {
    prisma.lostFoundPost.findUnique.mockResolvedValueOnce({ id: "p1", authorId: "alice" });
    prisma.lostFoundPost.update.mockResolvedValueOnce({ id: "p1", status: "RESOLVED" });
    const response = await request(app).patch("/api/lost-found/p1/resolve").set("Authorization", auth);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("RESOLVED");
  });
});
