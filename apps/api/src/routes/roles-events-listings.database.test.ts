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
  await prisma.studyGroupMember.deleteMany();
  await prisma.studyGroup.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.rsvp.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.update({ where: { id: "student" }, data: { role: "STUDENT" } });
  await Promise.all(["admin", "student", "other"].map((id) => prisma.profile.update({
    where: { userId: id }, data: { displayName: `${id} Test`, program: null, courses: [], interests: [] },
  })));
});
afterAll(async () => { await prisma?.$disconnect(); await database?.stop(); vi.doUnmock("../lib/prisma.js"); }, 30000);

describe("role assignment and events persisted in MongoDB", () => {
  it("discovers groups, joins once under concurrent retries, lists public members, and revokes chat access on leave", async () => {
    const created = await request(app).post("/api/study-groups").set("Authorization", studentToken).send({ name: "Group membership", courseCode: "INFO5103", description: "Revision together" });
    const id = created.body.id;
    const path = `/api/study-groups/${id}`;
    const otherToken = token("other");
    expect((await request(app).get(path).set("Authorization", otherToken)).body).toMatchObject({ id, isMember: false, memberCount: 1, conversationId: null });
    expect((await request(app).get("/api/study-groups").set("Authorization", otherToken)).body[0].id).toBe(id);
    const joined = await Promise.all([1, 2].map(() => request(app).post(`${path}/join`).set("Authorization", otherToken).send({ userId: "admin" })));
    expect(joined.map((response) => response.status)).toEqual([200, 200]);
    expect(await prisma.studyGroupMember.count({ where: { studyGroupId: id } })).toBe(2);
    expect(await prisma.participant.count({ where: { conversationId: created.body.conversationId } })).toBe(2);
    expect((await request(app).get(path).set("Authorization", otherToken)).body).toMatchObject({ isMember: true, memberCount: 2, conversationId: created.body.conversationId });
    const members = await request(app).get(`${path}/members`).set("Authorization", adminToken);
    expect(members.status).toBe(200);
    expect(members.body.map((member: { id: string }) => member.id).sort()).toEqual(["other", "student"]);
    expect(members.body.find((member: { id: string }) => member.id === "student").isCreator).toBe(true);
    expect(JSON.stringify(members.body)).not.toMatch(/@fanshaweonline|passwordHash|emailVerifiedAt/);
    expect((await request(app).post(`${path}/leave`).set("Authorization", adminToken)).status).toBe(404);
    const left = await request(app).post(`${path}/leave`).set("Authorization", studentToken);
    expect(left.body.deleted).toBe(false);
    expect((await request(app).get(`/api/conversations/${created.body.conversationId}`).set("Authorization", studentToken)).status).toBe(404);
    await expect(sendMessage("student", { conversationId: created.body.conversationId, text: "Not allowed after leaving" })).rejects.toThrow();
    expect((await request(app).get(`${path}/members`).set("Authorization", otherToken)).body.map((member: { id: string }) => member.id)).toEqual(["other"]);
    expect((await request(app).post(`${path}/join`).set("Authorization", studentToken)).status).toBe(200);
    await sendMessage("student", { conversationId: created.body.conversationId, text: "Rejoined" });
    const departures = await Promise.all([studentToken, otherToken].map((auth) => request(app).post(`${path}/leave`).set("Authorization", auth)));
    expect(departures.map((response) => response.status)).toEqual([200, 200]);
    expect(await prisma.studyGroup.count({ where: { id } })).toBe(0);
    expect(await prisma.studyGroupMember.count({ where: { studyGroupId: id } })).toBe(0);
    expect(await prisma.conversation.count({ where: { id: created.body.conversationId } })).toBe(0);
    expect(await prisma.message.count({ where: { conversationId: created.body.conversationId } })).toBe(0);
  });

  it.each([1, 2, 3, 4, 5])("keeps membership/chat consistent when the final departure races a new join (run %i)", async () => {
    const created = await request(app).post("/api/study-groups").set("Authorization", studentToken).send({ name: "Concurrent membership", courseCode: "INFO5103", description: "Race regression" });
    const id = created.body.id;
    const [left, joined] = await Promise.all([
      request(app).post(`/api/study-groups/${id}/leave`).set("Authorization", studentToken),
      request(app).post(`/api/study-groups/${id}/join`).set("Authorization", token("other")),
    ]);
    expect(left.status).toBe(200);
    expect([200, 404]).toContain(joined.status);
    const memberships = await prisma.studyGroupMember.findMany({ where: { studyGroupId: id } });
    const chat = await prisma.conversation.findUnique({ where: { directKey: `group:${id}` }, include: { participants: true } });
    if (joined.status === 200) {
      expect(memberships.map((member) => member.userId)).toEqual(["other"]);
      expect(chat?.participants.map((participant) => participant.userId)).toEqual(["other"]);
      expect(await prisma.studyGroup.count({ where: { id } })).toBe(1);
    } else {
      expect(memberships).toEqual([]);
      expect(chat).toBeNull();
      expect(await prisma.studyGroup.count({ where: { id } })).toBe(0);
    }
  });

  it("rolls back joins and leaves if synchronizing chat membership fails", async () => {
    const created = await request(app).post("/api/study-groups").set("Authorization", studentToken).send({ name: "Atomic membership", courseCode: "INFO5103", description: "Rollback test" });
    const transaction = prisma.$transaction.bind(prisma);
    for (const action of ["join", "leave"] as const) {
      const method = action === "join" ? "upsert" : "deleteMany";
      const failure = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (operation: unknown) => {
        if (typeof operation !== "function") throw new Error("Expected interactive transaction");
        return transaction(async (db) => operation({ ...db, participant: { ...db.participant, [method]: async () => { throw new Error("Simulated chat membership failure"); } } }));
      });
      try {
        const auth = action === "join" ? token("other") : studentToken;
        expect((await request(app).post(`/api/study-groups/${created.body.id}/${action}`).set("Authorization", auth)).status).toBe(500);
        expect((await prisma.studyGroupMember.findMany({ where: { studyGroupId: created.body.id } })).map((member) => member.userId)).toEqual(["student"]);
        expect((await prisma.participant.findMany({ where: { conversationId: created.body.conversationId } })).map((participant) => participant.userId)).toEqual(["student"]);
      } finally { failure.mockRestore(); }
    }
  });

  it("repairs legacy groups without a chat or membership revision for all members", async () => {
    const group = await prisma.studyGroup.create({ data: { name: "Legacy group", courseCode: "INFO5103", createdById: "student", members: { create: { userId: "student" } } } });
    await prisma.$runCommandRaw({ update: "StudyGroup", updates: [{ q: { _id: group.id }, u: { $unset: { membershipVersion: "" } } }] });
    const joined = await request(app).post(`/api/study-groups/${group.id}/join`).set("Authorization", token("other"));
    expect(joined.status).toBe(200);
    const participants = await prisma.participant.findMany({ where: { conversationId: joined.body.conversationId } });
    expect(participants.map((participant) => participant.userId).sort()).toEqual(["other", "student"]);
    expect((await prisma.studyGroup.findUniqueOrThrow({ where: { id: group.id } })).membershipVersion).toBe(1);
    await prisma.studyGroup.update({ where: { id: group.id }, data: { membershipVersion: null } });
    expect((await request(app).post(`/api/study-groups/${group.id}/join`).set("Authorization", token("other"))).status).toBe(200);
    expect((await prisma.studyGroup.findUniqueOrThrow({ where: { id: group.id } })).membershipVersion).toBe(1);
  });

  it("persists a study group, its creator membership and accepted chat, then reloads them", async () => {
    const response = await request(app).post("/api/study-groups").set("Authorization", studentToken).send({
      name: " Exam revision ", courseCode: " info-5103 ", description: " Review chapters together. ", createdById: "other", members: [{ userId: "admin" }],
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: "Exam revision", courseCode: "INFO5103", description: "Review chapters together.", memberCount: 1, isMember: true });
    expect(response.body.conversationId).toBeTruthy();
    const stored = await prisma.studyGroup.findUniqueOrThrow({ where: { id: response.body.id }, include: { members: true } });
    expect(stored).toMatchObject({ createdById: "student", name: "Exam revision", courseCode: "INFO5103", description: "Review chapters together." });
    expect(stored.members.map((member) => member.userId)).toEqual(["student"]);
    const chat = await prisma.conversation.findUniqueOrThrow({ where: { id: response.body.conversationId }, include: { participants: true } });
    expect(chat).toMatchObject({ type: "GROUP", status: "ACCEPTED", studyGroupId: stored.id, name: stored.name });
    expect(chat.participants.map((participant) => participant.userId)).toEqual(["student"]);
    const reloaded = await request(app).get("/api/study-groups").set("Authorization", studentToken);
    expect(reloaded.body).toEqual([response.body]);
    const otherView = await request(app).get("/api/study-groups").set("Authorization", adminToken);
    expect(otherView.body[0]).toMatchObject({ id: stored.id, isMember: false, conversationId: null });
    expect((await request(app).get(`/api/conversations/${chat.id}`).set("Authorization", adminToken)).status).toBe(404);
    const sent = await sendMessage("student", { conversationId: chat.id, text: "Welcome to our study group!" });
    expect(sent.message.text).toBe("Welcome to our study group!");
  });

  it("rolls back study-group and membership data if chat creation fails", async () => {
    const transaction = prisma.$transaction.bind(prisma);
    const failure = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (operation: unknown) => {
      if (typeof operation !== "function") throw new Error("Expected interactive transaction");
      return transaction(async (db) => operation({ ...db, conversation: { ...db.conversation, create: async () => { throw new Error("Simulated chat creation failure"); } } }));
    });
    try {
      const response = await request(app).post("/api/study-groups").set("Authorization", studentToken).send({ name: "Must roll back", courseCode: "INFO5103", description: "Atomic creation test" });
      expect(response.status).toBe(500);
      expect(await prisma.studyGroup.count()).toBe(0);
      expect(await prisma.studyGroupMember.count()).toBe(0);
      expect(await prisma.conversation.count()).toBe(0);
    } finally { failure.mockRestore(); }
  });

  it("persists searchable profile fields and matches program, course, interest and combined filters in MongoDB", async () => {
    const update = (id: string, data: object) => request(app).put("/api/profile/me").set("Authorization", token(id)).send(data);
    const search = async (query: string) => {
      const response = await request(app).get(`/api/profile/search?${query}`).set("Authorization", studentToken);
      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|emailVerifiedAt|@fanshaweonline/);
      return response.body;
    };
    expect((await update("student", { displayName: "Self", program: "Computer Programming", courses: ["INFO-5103"], interests: ["chess"] })).status).toBe(200);
    expect((await update("other", { displayName: "Morgan Student", program: "Computer Programming", courses: ["info-5103", "INFO 5103"], interests: [" Chess ", "CHESS", "hiking"] })).status).toBe(200);
    expect((await update("admin", { displayName: "Taylor Student", program: "Business", courses: ["INFO-5200"], interests: ["chess"] })).status).toBe(200);
    expect(await prisma.profile.findUniqueOrThrow({ where: { userId: "other" } })).toMatchObject({ courses: ["INFO5103"], interests: ["chess", "hiking"] });
    for (const query of ["program=computer", "course=info%205103", "q=morgan&program=COMPUTER&course=INFO-5103&interest=CHESS"]) {
      expect((await search(query)).map((row: { id: string }) => row.id)).toEqual(["other"]);
    }
    expect((await search("interest=CHESS")).map((row: { id: string }) => row.id).sort()).toEqual(["admin", "other"]);
    expect(await search("program=Business&course=INFO5103")).toEqual([]);
    await update("other", { displayName: "Morgan Student", program: "Computer Programming", interests: ["chess"] });
    expect((await search("course=INFO5103"))[0].courses).toEqual(["INFO5103"]);
    await update("other", { displayName: "Morgan Student", courses: [] });
    expect(await search("course=INFO5103")).toEqual([]);
    await prisma.user.update({ where: { id: "admin" }, data: { status: "SUSPENDED" } });
    try { expect(await search("program=Business")).toEqual([]); }
    finally { await prisma.user.update({ where: { id: "admin" }, data: { status: "ACTIVE" } }); }
    // Older MongoDB profiles can lack the new scalar-list field entirely.
    await prisma.$runCommandRaw({ update: "Profile", updates: [{ q: { _id: "other" }, u: { $unset: { courses: "" } } }] });
    expect((await search("q=Morgan"))[0].courses).toEqual([]);
  });

  it("persists unique RSVPs, shows saved events privately, and supports cancellation/re-RSVP", async () => {
    const created = await request(app).post("/api/events").set("Authorization", token("other", "ORGANIZER")).send(futureEvent());
    expect(created.status).toBe(201);
    const id = created.body.id;
    const path = `/api/events/${id}/rsvp`;
    const responses = await Promise.all([1, 2].map(() => request(app).post(path).set("Authorization", studentToken)));
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await prisma.rsvp.count({ where: { eventId: id, userId: "student" } })).toBe(1);
    const browse = await request(app).get("/api/events").set("Authorization", studentToken);
    expect(browse.body[0]).toMatchObject({ id, isRsvped: true });
    expect(browse.body[0]).not.toHaveProperty("rsvps");
    const saved = await request(app).get("/api/events/saved").set("Authorization", studentToken);
    expect(saved.body).toHaveLength(1);
    expect(saved.body[0]).toMatchObject({ id, title: created.body.title, isRsvped: true, organizer: { id: "other" } });
    expect((await request(app).get("/api/events/saved").set("Authorization", adminToken)).body).toEqual([]);
    expect((await request(app).delete(path).set("Authorization", adminToken)).status).toBe(204);
    expect(await prisma.rsvp.count({ where: { eventId: id } })).toBe(1);
    expect((await request(app).delete(path).set("Authorization", studentToken)).status).toBe(204);
    expect((await request(app).delete(path).set("Authorization", studentToken)).status).toBe(204);
    expect((await request(app).get("/api/events/saved").set("Authorization", studentToken)).body).toEqual([]);
    expect((await request(app).get("/api/events").set("Authorization", studentToken)).body[0].isRsvped).toBe(false);
    expect((await request(app).post(path).set("Authorization", studentToken)).status).toBe(200);
    await request(app).patch(`/api/events/${id}/cancel`).set("Authorization", token("other", "ORGANIZER"));
    expect((await request(app).get("/api/events/saved").set("Authorization", studentToken)).body[0].status).toBe("CANCELLED");
    expect((await request(app).post(path).set("Authorization", studentToken)).status).toBe(409);
    expect((await request(app).delete(path).set("Authorization", studentToken)).status).toBe(204);
    expect(await prisma.rsvp.count({ where: { eventId: id } })).toBe(0);
  });

  it("keeps past saved events visible, blocks new RSVPs, and excludes drafts", async () => {
    const past = await prisma.event.create({ data: { ...futureEvent(), startsAt: new Date("2020-01-01"), endsAt: null, organizerId: "other", status: "PUBLISHED" } });
    const draft = await prisma.event.create({ data: { ...futureEvent(), organizerId: "other", status: "DRAFT" } });
    for (const eventId of [past.id, draft.id]) await prisma.rsvp.create({ data: { eventId, userId: "student" } });
    const saved = await request(app).get("/api/events/saved").set("Authorization", studentToken);
    expect(saved.body.map((event: { id: string }) => event.id)).toEqual([past.id]);
    expect((await request(app).post(`/api/events/${past.id}/rsvp`).set("Authorization", adminToken)).status).toBe(409);
    expect((await request(app).post(`/api/events/${draft.id}/rsvp`).set("Authorization", studentToken)).status).toBe(404);
  });

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
