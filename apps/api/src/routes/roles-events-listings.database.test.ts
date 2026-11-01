import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { signToken } from "../lib/jwt.js";

let database: MongoMemoryReplSet | undefined;
let prisma: PrismaClient;
let app: ReturnType<typeof import("../app.js").createApp>;
let sendMessage: typeof import("../lib/messages.js").sendMessage;
const token = (id: string, role = "STUDENT") => `Bearer ${signToken({ userId: id, role })}`;
const studentToken = token("student");
const adminToken = token("admin", "ADMINISTRATOR");
const futureEvent = () => ({ title: "Campus games", description: "Meet classmates", location: "Student Union", startsAt: new Date(Date.now() + 86_400_000).toISOString(), endsAt: new Date(Date.now() + 90_000_000).toISOString() });
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=";

beforeAll(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const url = database.getUri("campushub_roles_events_listings_test");
  const require = createRequire(import.meta.url);
  await promisify(execFile)(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--schema", fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)), "--skip-generate"], { env: { ...process.env, DATABASE_URL: url }, timeout: 60000 });
  prisma = new PrismaClient({ datasourceUrl: url });
  vi.doMock("../lib/prisma.js", () => ({ prisma }));
  const { createApp } = await import("../app.js");
  app = createApp();
  ({ sendMessage } = await import("../lib/messages.js"));
  for (const [id, role] of [["admin", "ADMINISTRATOR"], ["student", "STUDENT"], ["other", "ORGANIZER"]] as const) {
    await prisma.user.create({ data: { id, email: `${id}@fanshaweonline.ca`, passwordHash: "not-returned", status: "ACTIVE", emailVerifiedAt: new Date(), role, profile: { create: { displayName: `${id} Test`, interests: [] } } } });
  }
  await prisma.category.create({ data: { id: "books", name: "Books", slug: "books" } });
}, 180000);

beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.update({ where: { id: "student" }, data: { role: "STUDENT" } });
});
afterAll(async () => { await prisma?.$disconnect(); await database?.stop(); vi.doUnmock("../lib/prisma.js"); }, 30000);

describe("role assignment and events persisted in MongoDB", () => {
  it("lets an administrator promote a verified member to Administrator using an existing Student token", async () => {
    expect((await request(app).patch("/api/admin/users/student/role").set("Authorization", token("other", "ADMINISTRATOR")).send({ role: "ADMINISTRATOR" })).status).toBe(403);
    const promoted = await request(app).patch("/api/admin/users/student/role").set("Authorization", adminToken).send({ role: "ADMINISTRATOR" });
    expect(promoted.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "student" } })).role).toBe("ADMINISTRATOR");
    expect((await request(app).get("/api/admin/users").set("Authorization", studentToken)).status).toBe(200);
    expect((await request(app).patch("/api/admin/users/student/role").set("Authorization", studentToken).send({ role: "STUDENT" })).status).toBe(403);
  });
  it("persists optional end fields/photos and keeps event details in a reusable organizer chat", async () => {
    const organizerToken = token("other", "ORGANIZER");
    const startsAt = "2099-01-01T18:00:00-05:00";
    const input = { ...futureEvent(), startsAt, endsAt: null, endDate: "2099-01-20", imageUrl: image };
    const created = await request(app).post("/api/events").set("Authorization", organizerToken).send(input);
    expect(created.status).toBe(201);
    const eventId = created.body.id;
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({ endsAt: null, endDate: "2099-01-20", imageUrl: image });

    const general = await request(app).post("/api/conversations").set("Authorization", studentToken).send({ recipientId: "other" });
    const started = await request(app).post("/api/conversations").set("Authorization", studentToken).send({ recipientId: "other", eventId });
    expect(started.status).toBe(201);
    expect(started.body.id).not.toBe(general.body.id);
    expect(started.body.event).toMatchObject({ id: eventId, endsAt: null, endDate: "2099-01-20", imageUrl: image, organizer: { id: "other" } });
    const repeated = await request(app).post("/api/conversations").set("Authorization", studentToken).send({ recipientId: "other", eventId });
    expect(repeated.status).toBe(200);
    expect(repeated.body.id).toBe(started.body.id);

    const secondEvent = await request(app).post("/api/events").set("Authorization", organizerToken).send({ ...input, title: "Another event" });
    const secondChat = await request(app).post("/api/conversations").set("Authorization", studentToken).send({ recipientId: "other", eventId: secondEvent.body.id });
    expect(secondChat.body.id).not.toBe(started.body.id);

    const sent = await sendMessage("student", { conversationId: started.body.id, text: "Can my team join?", clientId: "event-inquiry" });
    expect(sent.message.text).toBe("Can my team join?");
    const requests = await request(app).get("/api/conversations?tab=requests").set("Authorization", organizerToken);
    expect(requests.status).toBe(200);
    expect(requests.body).toHaveLength(1);
    expect(requests.body[0].event.id).toBe(eventId);
    expect((await request(app).get(`/api/conversations/${started.body.id}`).set("Authorization", adminToken)).status).toBe(404);
    const reply = await sendMessage("other", { conversationId: started.body.id, text: "Yes, welcome!", clientId: "event-reply" });
    expect(reply.accepted).toBe(true);
    const inbox = await request(app).get("/api/conversations").set("Authorization", organizerToken);
    expect(inbox.body.map((conversation: { id: string }) => conversation.id)).toContain(started.body.id);
    const messages = await request(app).get(`/api/conversations/${started.body.id}/messages`).set("Authorization", studentToken);
    expect(messages.body.messages.map((message: { text: string }) => message.text)).toEqual(["Can my team join?", "Yes, welcome!"]);
    const reopened = await request(app).get(`/api/conversations/${started.body.id}`).set("Authorization", organizerToken);
    expect(reopened.body.event).toMatchObject({ title: input.title, description: input.description, endDate: "2099-01-20" });
    expect(JSON.stringify(reopened.body)).not.toContain("passwordHash");

    const edited = await request(app).put(`/api/events/${eventId}`).set("Authorization", organizerToken).send({ ...input, title: "Updated league", endsAt: "2099-01-20T12:00:00-05:00" });
    expect(edited.status).toBe(200);
    expect(edited.body.endsAt).toBe("2099-01-20T17:00:00.000Z");
    const removed = await request(app).put(`/api/events/${eventId}`).set("Authorization", organizerToken).send({ ...input, endsAt: null, endDate: null, imageUrl: null });
    expect(removed.status).toBe(200);
    expect(await prisma.event.findUniqueOrThrow({ where: { id: eventId } })).toMatchObject({ endsAt: null, endDate: null, imageUrl: null });
    await request(app).patch(`/api/events/${eventId}/cancel`).set("Authorization", organizerToken);
    const afterCancel = await request(app).get(`/api/conversations/${started.body.id}`).set("Authorization", studentToken);
    expect(afterCancel.body.event.status).toBe("CANCELLED");
  });
  it("promotes and revokes organizer access without trusting old JWT roles", async () => {
    expect((await request(app).post("/api/events").set("Authorization", studentToken).send(futureEvent())).status).toBe(403);
    expect((await request(app).patch("/api/admin/users/student/role").set("Authorization", token("student", "ADMINISTRATOR")).send({ role: "ORGANIZER" })).status).toBe(403);
    const promoted = await request(app).patch("/api/admin/users/student/role").set("Authorization", adminToken).send({ role: "ORGANIZER" });
    expect(promoted.status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: "student" } })).role).toBe("ORGANIZER");
    const created = await request(app).post("/api/events").set("Authorization", studentToken).send(futureEvent());
    expect(created.status).toBe(201);
    expect((await request(app).get("/api/events/mine").set("Authorization", studentToken)).body).toHaveLength(1);
    expect((await request(app).patch("/api/admin/users/student/role").set("Authorization", adminToken).send({ role: "STUDENT" })).status).toBe(200);
    const oldOrganizerToken = token("student", "ORGANIZER");
    expect((await request(app).put(`/api/events/${created.body.id}`).set("Authorization", oldOrganizerToken).send(futureEvent())).status).toBe(403);
    expect((await request(app).patch(`/api/events/${created.body.id}/cancel`).set("Authorization", oldOrganizerToken)).status).toBe(403);
    expect((await request(app).get("/api/profile/me").set("Authorization", oldOrganizerToken)).body.role).toBe("STUDENT");
  });
  it("browses only upcoming published events, with date/time/location/organizer and stable paging", async () => {
    const now = Date.now();
    await prisma.event.createMany({ data: [
      { id: "later", status: "PUBLISHED" as const, startsAt: new Date(now + 172800000) },
      { id: "soon", status: "PUBLISHED" as const, startsAt: new Date(now + 86400000) },
      { id: "past", status: "PUBLISHED" as const, startsAt: new Date(now - 86400000) },
      { id: "cancelled", status: "CANCELLED" as const, startsAt: new Date(now + 86400000) },
      { id: "draft", status: "DRAFT" as const, startsAt: new Date(now + 86400000) },
    ].map((entry) => ({ ...futureEvent(), ...entry, organizerId: "other", endsAt: new Date(entry.startsAt.getTime() + 3600000) })) });
    const response = await request(app).get("/api/events?limit=1").set("Authorization", studentToken);
    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ id: "soon", location: "Student Union", organizer: { id: "other", profile: { displayName: "other Test" } } });
    expect(response.body[0].startsAt).toBeTruthy();
    expect(response.body[0].endsAt).toBeTruthy();
    expect(response.headers["x-has-more"]).toBe("true");
    const second = await request(app).get("/api/events?limit=1&page=2").set("Authorization", studentToken);
    expect(second.body.map((event: { id: string }) => event.id)).toEqual(["later"]);
    expect(second.headers["x-has-more"]).toBe("false");
    expect(JSON.stringify(response.body)).not.toContain("@fanshaweonline.ca");
  });
  it("persists event edits/cancellation, enforces ownership, and hides cancelled events from browsing", async () => {
    const organizerToken = token("other", "ORGANIZER");
    const created = await request(app).post("/api/events").set("Authorization", organizerToken).send(futureEvent());
    const id = created.body.id;
    expect(created.status).toBe(201);
    expect((await request(app).put(`/api/events/${id}`).set("Authorization", adminToken).send(futureEvent())).status).toBe(403);
    expect((await request(app).put(`/api/events/${id}`).set("Authorization", organizerToken).send({ ...futureEvent(), title: "Updated event" })).status).toBe(200);
    expect((await prisma.event.findUniqueOrThrow({ where: { id } })).title).toBe("Updated event");
    expect((await request(app).patch(`/api/events/${id}/cancel`).set("Authorization", organizerToken)).status).toBe(200);
    expect((await prisma.event.findUniqueOrThrow({ where: { id } })).status).toBe("CANCELLED");
    expect((await request(app).get("/api/events").set("Authorization", studentToken)).body).toEqual([]);
    const managed = await request(app).get("/api/events/mine").set("Authorization", organizerToken);
    expect(managed.body[0].status).toBe("CANCELLED");
    expect((await request(app).put(`/api/events/${id}`).set("Authorization", organizerToken).send(futureEvent())).status).toBe(409);
  });
  it("searches actual users and exposes no credential fields", async () => {
    const response = await request(app).get("/api/admin/users?search=student%20Test&role=STUDENT").set("Authorization", adminToken);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe("student");
    expect(response.body[0]).not.toHaveProperty("passwordHash");
    expect(response.body[0]).not.toHaveProperty("otpHash");
    expect((await request(app).patch("/api/admin/users/admin/role").set("Authorization", adminToken).send({ role: "STUDENT" })).status).toBe(403);
  });
  it("creates normal users as Student by default", async () => {
    const user = await prisma.user.create({ data: { email: "new-student@fanshaweonline.ca", passwordHash: "unused" } });
    expect(user.role).toBe("STUDENT");
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe("marketplace owner changes persisted in MongoDB", () => {
  it("returns small notification counts and lightweight chat rows while keeping full ad references on opening", async () => {
    await prisma.listing.create({ data: { id: "summary-listing", sellerId: "other", categoryId: "books", title: "Summary listing", description: "Full description", priceCents: 2500, condition: "GOOD", images: { create: { url: image, sortOrder: 0 } } } });
    await prisma.conversation.create({ data: { id: "summary-chat", directKey: "summary-chat", listingId: "summary-listing", status: "ACCEPTED", participants: { create: [{ userId: "student" }, { userId: "other" }] }, lastMessage: { text: "Hello", senderId: "other", createdAt: new Date() } } });
    await sendMessage("other", { conversationId: "summary-chat", text: "Hello", clientId: "summary-first" });
    await sendMessage("other", { conversationId: "summary-chat", text: "Another message", clientId: "summary-second" });
    const counts = await request(app).get("/api/conversations/counts").set("Authorization", studentToken);
    expect(counts.status).toBe(200);
    expect(counts.body).toEqual({ unreadTotal: 2, requestCount: 0 });
    expect(JSON.stringify(counts.body).length).toBeLessThan(100);
    const list = await request(app).get("/api/conversations").set("Authorization", studentToken);
    expect(list.body[0].listing).toEqual({ id: "summary-listing", title: "Summary listing" });
    expect(list.body[0].unreadCount).toBe(2);
    const opened = await request(app).get("/api/conversations/summary-chat").set("Authorization", studentToken);
    expect(opened.body.listing).toMatchObject({ description: "Full description", imageUrl: image });
    await request(app).patch("/api/conversations/summary-chat/read").set("Authorization", studentToken);
    expect((await request(app).get("/api/conversations/counts").set("Authorization", studentToken)).body.unreadTotal).toBe(0);
  });
  it("rolls back a message when updating its conversation fails", async () => {
    await prisma.conversation.create({ data: { id: "atomic-chat", directKey: "atomic-chat", status: "ACCEPTED", participants: { create: [{ userId: "student" }, { userId: "other" }] } } });
    const transaction = prisma.$transaction.bind(prisma);
    const failure = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (operation: unknown) => {
      if (typeof operation !== "function") throw new Error("Expected interactive transaction");
      return transaction(async (db) => operation({ ...db, conversation: { ...db.conversation, update: async () => { throw new Error("Simulated conversation failure"); } } }));
    });
    try {
      await expect(sendMessage("student", { conversationId: "atomic-chat", text: "Must not partially save" })).rejects.toThrow("Simulated conversation failure");
      expect(await prisma.message.count({ where: { conversationId: "atomic-chat" } })).toBe(0);
    } finally { failure.mockRestore(); }
  });
  it("loads requests and their message history when the other account has been deleted", async () => {
    await prisma.user.create({ data: { id: "deleted-sender", email: "deleted-sender@fanshaweonline.ca", passwordHash: "unused", status: "ACTIVE" } });
    const conversation = await prisma.conversation.create({ data: {
      directKey: "deleted-sender:student", type: "DIRECT", status: "PENDING", requestedById: "deleted-sender",
      participants: { create: [{ userId: "student" }, { userId: "deleted-sender" }] },
      lastMessage: { text: "An older request", senderId: "deleted-sender", createdAt: new Date() },
      messages: { create: { senderId: "deleted-sender", text: "An older request", attachments: [] } },
    } });
    // Simulate an account removed outside Prisma, as can happen in an existing MongoDB database.
    await prisma.$runCommandRaw({ delete: "User", deletes: [{ q: { _id: "deleted-sender" }, limit: 1 }] });
    const requests = await request(app).get("/api/conversations?tab=requests").set("Authorization", studentToken);
    expect(requests.status).toBe(200);
    expect(requests.body[0]).toMatchObject({ id: conversation.id, name: "Deleted account", isRequest: true });
    expect(requests.body[0].members.map((member: { id: string }) => member.id)).toEqual(["student"]);
    const opened = await request(app).get(`/api/conversations/${conversation.id}`).set("Authorization", studentToken);
    expect(opened.status).toBe(200);
    expect(opened.body.name).toBe("Deleted account");
    const history = await request(app).get(`/api/conversations/${conversation.id}/messages`).set("Authorization", studentToken);
    expect(history.status).toBe(200);
    expect(history.body.messages[0].text).toBe("An older request");
    expect(await prisma.participant.count({ where: { conversationId: conversation.id } })).toBe(2);
    expect((await request(app).patch(`/api/conversations/${conversation.id}/ignore`).set("Authorization", studentToken)).status).toBe(200);
    expect((await request(app).get("/api/conversations?tab=requests").set("Authorization", studentToken)).body).toEqual([]);
  });
  it("separates ads from general DMs and delivers each first inquiry to Requests with its ad reference", async () => {
    const buyerToken = token("other");
    const input = { title: "Textbook", description: "Almost new", priceCents: 2500, categoryId: "books", condition: "GOOD", images: [{ url: image }] };
    const firstAd = await request(app).post("/api/listings").set("Authorization", studentToken).send(input);
    const secondAd = await request(app).post("/api/listings").set("Authorization", studentToken).send({ ...input, title: "Calculator" });
    const general = await request(app).post("/api/conversations").set("Authorization", buyerToken).send({ recipientId: "student" });
    await sendMessage("other", { conversationId: general.body.id, text: "Hi there" });
    expect((await request(app).get("/api/conversations?tab=requests").set("Authorization", studentToken)).body.map((conversation: { id: string }) => conversation.id)).toContain(general.body.id);
    await sendMessage("student", { conversationId: general.body.id, text: "Hello" });

    const first = await request(app).post("/api/conversations").set("Authorization", buyerToken).send({ recipientId: "student", listingId: firstAd.body.id });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ status: "PENDING", listing: { title: "Textbook", priceCents: 2500, imageUrl: image, sellerName: "student Test" } });
    expect(first.body.id).not.toBe(general.body.id);
    expect((await request(app).get("/api/conversations?tab=requests").set("Authorization", studentToken)).body).toEqual([]);
    await sendMessage("other", { conversationId: first.body.id, text: "Is this book available?" });
    const requests = await request(app).get("/api/conversations?tab=requests").set("Authorization", studentToken);
    expect(requests.body.map((conversation: { id: string }) => conversation.id)).toEqual([first.body.id]);
    const inboxBefore = await request(app).get("/api/conversations").set("Authorization", studentToken);
    expect(inboxBefore.body.map((conversation: { id: string }) => conversation.id)).not.toContain(first.body.id);
    const opened = await request(app).get(`/api/conversations/${first.body.id}`).set("Authorization", studentToken);
    expect(opened.body.isRequest).toBe(true);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: first.body.id } })).status).toBe("PENDING");
    const repeated = await request(app).post("/api/conversations").set("Authorization", buyerToken).send({ recipientId: "student", listingId: firstAd.body.id });
    expect(repeated.body.id).toBe(first.body.id);
    await request(app).patch(`/api/conversations/${first.body.id}/accept`).set("Authorization", studentToken);
    expect((await request(app).get("/api/conversations?tab=requests").set("Authorization", studentToken)).body).toEqual([]);
    expect((await request(app).get("/api/conversations").set("Authorization", studentToken)).body.map((conversation: { id: string }) => conversation.id)).toContain(first.body.id);

    const second = await request(app).post("/api/conversations").set("Authorization", studentToken).send({ recipientId: "other", listingId: secondAd.body.id });
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.body.id);
    expect(second.body.listing.title).toBe("Calculator");
    await sendMessage("student", { conversationId: second.body.id, text: "Here is the calculator you asked about" });
    expect((await request(app).get("/api/conversations?tab=requests").set("Authorization", buyerToken)).body[0].id).toBe(second.body.id);
    await sendMessage("other", { conversationId: second.body.id, text: "Thanks!" });
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: second.body.id } })).status).toBe("ACCEPTED");
    await request(app).patch(`/api/listings/${firstAd.body.id}/sold`).set("Authorization", studentToken);
    expect((await request(app).get(`/api/conversations/${first.body.id}`).set("Authorization", buyerToken)).body.listing.status).toBe("SOLD");
    await request(app).delete(`/api/listings/${firstAd.body.id}`).set("Authorization", studentToken);
    const retained = await request(app).get(`/api/conversations/${first.body.id}`).set("Authorization", buyerToken);
    expect(retained.body.listing).toMatchObject({ title: "Textbook", status: "REMOVED" });
    const history = await request(app).get(`/api/conversations/${first.body.id}/messages`).set("Authorization", buyerToken);
    expect(history.body.messages[0].text).toBe("Is this book available?");
  });
  it("edits, marks sold, and removes a student's listing while preserving its conversation", async () => {
    const input = { title: "Textbook", description: "Almost new", priceCents: 2500, categoryId: "books", condition: "GOOD", images: [{ url: image }, { url: image }] };
    const created = await request(app).post("/api/listings").set("Authorization", studentToken).send(input);
    expect(created.status).toBe(201);
    const id = created.body.id;
    for (const method of ["put", "patch", "delete"] as const) {
      expect((await request(app)[method](`/api/listings/${id}${method === "patch" ? "/sold" : ""}`).set("Authorization", token("other", "ORGANIZER")).send(input)).status).toBe(403);
    }
    const edited = await request(app).put(`/api/listings/${id}`).set("Authorization", studentToken).send({ ...input, title: "Updated textbook", priceCents: 2000, images: [{ url: image }] });
    expect(edited.status).toBe(200);
    const saved = await prisma.listing.findUniqueOrThrow({ where: { id }, include: { images: true } });
    expect(saved).toMatchObject({ title: "Updated textbook", priceCents: 2000, sellerId: "student", status: "ACTIVE" });
    expect(saved.images).toHaveLength(1);
    const conversation = await prisma.conversation.create({ data: { directKey: "listing:test", listingId: id } });
    expect((await request(app).patch(`/api/listings/${id}/sold`).set("Authorization", studentToken)).status).toBe(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id } })).status).toBe("SOLD");
    const soldDetails = await request(app).get(`/api/listings/${id}`).set("Authorization", studentToken);
    expect(soldDetails.status).toBe(200);
    expect(soldDetails.body.status).toBe("SOLD");
    expect((await request(app).get("/api/listings?mine=true").set("Authorization", studentToken)).body[0].id).toBe(id);
    expect((await request(app).delete(`/api/listings/${id}`).set("Authorization", studentToken)).status).toBe(204);
    expect((await request(app).get(`/api/listings/${id}`).set("Authorization", studentToken)).status).toBe(404);
    expect((await request(app).get("/api/listings").set("Authorization", studentToken)).body).toEqual([]);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).listingId).toBe(id);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id } })).status).toBe("REMOVED");
  });
});
