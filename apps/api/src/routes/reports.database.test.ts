import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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
const auth = (id: string) => `Bearer ${signToken({ userId: id, role: "STUDENT" })}`;
const student = auth("student");
const admin = auth("admin");
const fileA = { url: "https://example.test/notes-a.pdf", name: "Notes A.pdf", mimeType: "application/pdf", size: 200 };
const fileB = { url: "https://example.test/notes-b.pdf", name: "Notes B.pdf", mimeType: "application/pdf", size: 300 };

beforeAll(async () => {
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const url = database.getUri("campushub_reports_test");
  const require = createRequire(import.meta.url);
  await promisify(execFile)(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--schema", fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)), "--skip-generate"], { env: { ...process.env, DATABASE_URL: url }, timeout: 60000 });
  prisma = new PrismaClient({ datasourceUrl: url });
  vi.doMock("../lib/prisma.js", () => ({ prisma }));
  app = (await import("../app.js")).createApp();
  for (const [id, role] of [["student", "STUDENT"], ["other", "STUDENT"], ["stranger", "STUDENT"], ["admin", "ADMINISTRATOR"], ["admin2", "ADMINISTRATOR"]] as const) {
    await prisma.user.create({ data: { id, role, email: `${id}@fanshaweonline.ca`, passwordHash: "not-exposed", status: "ACTIVE", emailVerifiedAt: new Date(), profile: { create: { displayName: `${id} Test`, interests: [] } } } });
  }
  await prisma.category.create({ data: { id: "books", slug: "books", name: "Books" } });
}, 180000);

beforeEach(async () => {
  await prisma.moderationAction.deleteMany();
  await prisma.report.deleteMany();
  await prisma.message.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.lostFoundPost.deleteMany();
  await prisma.user.update({ where: { id: "admin" }, data: { role: "ADMINISTRATOR" } });
  await prisma.listing.create({ data: { id: "listing", sellerId: "other", categoryId: "books", title: "A reported textbook", description: "The original listing text", priceCents: 2500, condition: "GOOD" } });
  await prisma.lostFoundPost.create({ data: { id: "post", authorId: "other", kind: "LOST", title: "Lost keys", description: "The original post text", location: "Library", occurredOn: new Date("2026-10-01T00:00:00Z") } });
  await prisma.conversation.create({ data: { id: "chat", directKey: "other_student", status: "ACCEPTED", participants: { create: [{ userId: "other" }, { userId: "student" }] }, lastMessage: { text: "Reported message text", senderId: "other", createdAt: new Date() } } });
  await prisma.message.create({ data: { id: "message", conversationId: "chat", senderId: "other", text: "Reported message text", attachments: [fileA, fileB] } });
});
afterAll(async () => { await prisma?.$disconnect(); await database?.stop(); vi.doUnmock("../lib/prisma.js"); }, 30000);

async function submit(targetType = "LISTING", targetId = "listing", extra: object = {}) {
  return request(app).post("/api/reports").set("Authorization", student).send({ targetType, targetId, reason: "SCAM", note: "Please check this", ...extra });
}
async function action(id: string, value: string, token = admin) {
  return request(app).post(`/api/admin/reports/${id}/actions`).set("Authorization", token).send({ action: value, note: "Reviewed by administrator" });
}

describe("reporting and moderation persisted in MongoDB", () => {
  it.each([["LISTING", "listing"], ["LOST_FOUND_POST", "post"], ["MESSAGE", "message"], ["FILE", "message"]])("stores a %s report, reason, note, timestamp and snapshot", async (targetType, targetId) => {
    const response = await submit(targetType, targetId, targetType === "FILE" ? { attachmentIndex: 1 } : {});
    expect(response.status).toBe(201);
    const saved = await prisma.report.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(saved).toMatchObject({ reporterId: "student", targetType, targetId, reason: "SCAM", note: "Please check this", status: "OPEN", createdAt: expect.any(Date) });
    expect(saved.snapshot).toBeTruthy();
    const repeated = await submit(targetType, targetId, targetType === "FILE" ? { attachmentIndex: 1 } : {});
    expect(repeated.status).toBe(200);
    expect(repeated.body.id).toBe(response.body.id);
    expect(await prisma.report.count()).toBe(1);
    const page = await request(app).get("/api/admin/reports").set("Authorization", admin);
    expect(page.status).toBe(200);
    expect(page.body[0]).toMatchObject({ reporter: { name: "student Test", email: "student@fanshaweonline.ca" }, status: "OPEN" });
    expect(JSON.stringify(page.body)).not.toContain("passwordHash");
    expect(JSON.stringify(page.body)).not.toContain("not-exposed");
  });
  it("checks private-message/file membership and limits admin previews to the reported content", async () => {
    for (const targetType of ["MESSAGE", "FILE"]) {
      const response = await request(app).post("/api/reports").set("Authorization", auth("stranger")).send({ targetType, targetId: "message", reason: "HARASSMENT", ...(targetType === "FILE" ? { attachmentIndex: 0 } : {}) });
      expect(response.status).toBe(404);
    }
    await prisma.message.create({ data: { conversationId: "chat", senderId: "other", text: "Unreported private text", attachments: [] } });
    await submit("MESSAGE", "message");
    const page = await request(app).get("/api/admin/reports").set("Authorization", admin);
    expect(page.body[0].snapshot.text).toBe("Reported message text");
    expect(JSON.stringify(page.body)).not.toContain("Unreported private text");
    expect((await request(app).get("/api/conversations/chat/messages").set("Authorization", admin)).status).toBe(404);
  });
  it("rejects own content, revoked administrators and non-admin report browsing", async () => {
    expect((await request(app).post("/api/reports").set("Authorization", auth("other")).send({ targetType: "LISTING", targetId: "listing", reason: "OTHER" })).status).toBe(400);
    const report = await submit();
    expect((await request(app).get("/api/admin/reports").set("Authorization", student)).status).toBe(403);
    await prisma.user.update({ where: { id: "admin" }, data: { role: "STUDENT" } });
    expect((await action(report.body.id, "REMOVE_CONTENT")).status).toBe(403);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: "listing" } })).status).toBe("ACTIVE");
  });
  it("soft-removes a listing while retaining its snapshot and linked chat", async () => {
    await prisma.conversation.update({ where: { id: "chat" }, data: { listingId: "listing" } });
    const report = await submit();
    expect((await action(report.body.id, "REMOVE_CONTENT")).status).toBe(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: "listing" } })).status).toBe("REMOVED");
    expect((await request(app).get("/api/listings").set("Authorization", student)).body).toEqual([]);
    expect((await request(app).get("/api/listings/listing").set("Authorization", student)).status).toBe(404);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: "chat" } })).listingId).toBe("listing");
    const saved = await prisma.report.findUniqueOrThrow({ where: { id: report.body.id }, include: { moderationActions: true } });
    expect(saved.status).toBe("RESOLVED");
    expect(saved.moderationActions[0]).toMatchObject({ adminId: "admin", action: "REMOVE_CONTENT", note: "Reviewed by administrator" });
    expect(saved.snapshot).toMatchObject({ text: "The original listing text" });
  });
  it("hides a moderated lost-and-found post from search and prevents owner actions", async () => {
    const report = await submit("LOST_FOUND_POST", "post");
    expect((await action(report.body.id, "REMOVE_CONTENT")).status).toBe(200);
    expect((await request(app).get("/api/lost-found?search=keys").set("Authorization", student)).body).toEqual([]);
    expect((await request(app).patch("/api/lost-found/post/resolve").set("Authorization", auth("other"))).status).toBe(404);
    expect((await submit("LOST_FOUND_POST", "post")).status).toBe(404);
  });
  it("replaces removed messages with a tombstone and updates the conversation preview", async () => {
    const report = await submit("MESSAGE", "message");
    expect((await action(report.body.id, "REMOVE_CONTENT")).status).toBe(200);
    const saved = await prisma.message.findUniqueOrThrow({ where: { id: "message" } });
    expect(saved.text).toBe("[Message removed by an administrator]");
    expect(saved.attachments).toEqual([]);
    expect(saved.removedAt).toBeInstanceOf(Date);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: "chat" } })).lastMessage?.text).toBe(saved.text);
    const history = await request(app).get("/api/conversations/chat/messages").set("Authorization", student);
    expect(history.body.messages[0].removedAt).toBeTruthy();
    expect((await submit("MESSAGE", "message")).status).toBe(404);
  });
  it("removes the correct file after another attachment changes its index", async () => {
    const reportA = await submit("FILE", "message", { attachmentIndex: 0 });
    const reportB = await submit("FILE", "message", { attachmentIndex: 1 });
    expect(reportA.status).toBe(201); expect(reportB.status).toBe(201);
    expect(reportA.body.id).not.toBe(reportB.body.id);
    expect((await action(reportA.body.id, "REMOVE_CONTENT")).status).toBe(200);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: "message" } })).attachments).toEqual([fileB]);
    expect((await action(reportB.body.id, "REMOVE_CONTENT")).status).toBe(200);
    expect((await prisma.message.findUniqueOrThrow({ where: { id: "message" } }))).toMatchObject({ text: "Reported message text", attachments: [], removedAt: null });
  });
  it.each(["RESOLVE", "DISMISS"])("records %s without changing the content", async (value) => {
    const report = await submit();
    expect((await action(report.body.id, value)).status).toBe(200);
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: "listing" } })).status).toBe("ACTIVE");
    expect((await prisma.report.findUniqueOrThrow({ where: { id: report.body.id } })).status).toBe(value === "DISMISS" ? "DISMISSED" : "RESOLVED");
    expect((await action(report.body.id, "REMOVE_CONTENT")).status).toBe(409);
    expect(await prisma.moderationAction.count()).toBe(1);
  });
  it("allows only one winner when two administrators review the same report", async () => {
    const report = await submit();
    const decisions = await Promise.all([action(report.body.id, "RESOLVE"), action(report.body.id, "DISMISS", auth("admin2"))]);
    expect(decisions.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.moderationAction.count()).toBe(1);
  });
  it("rolls back a decision when removal cannot be performed", async () => {
    const legacy = await prisma.report.create({ data: { reporterId: "student", targetType: "EVENT", targetId: "legacy", reason: "OTHER" } });
    expect((await action(legacy.id, "REMOVE_CONTENT")).status).toBe(400);
    expect((await prisma.report.findUniqueOrThrow({ where: { id: legacy.id } })).status).toBe("OPEN");
    expect(await prisma.moderationAction.count()).toBe(0);
  });
  it("loads legacy reports and reports from deleted accounts, with stable pagination", async () => {
    await prisma.report.create({ data: { reporterId: "student", targetType: "LISTING", targetId: "listing", reason: "Old reason", status: "ACTIONED" } });
    await submit();
    const resolved = await request(app).get("/api/admin/reports?status=RESOLVED").set("Authorization", admin);
    expect(resolved.body[0]).toMatchObject({ status: "RESOLVED", snapshot: null });
    const page = await request(app).get("/api/admin/reports?status=ALL&limit=1").set("Authorization", admin);
    expect(page.body).toHaveLength(1);
    expect(page.headers["x-has-more"]).toBe("true");
    await prisma.user.create({ data: { id: "departed", email: "departed@fanshaweonline.ca", passwordHash: "unused", status: "ACTIVE" } });
    await prisma.report.create({ data: { reporterId: "departed", targetType: "LISTING", targetId: "listing", reason: "OTHER" } });
    await prisma.$runCommandRaw({ delete: "User", deletes: [{ q: { _id: "departed" }, limit: 1 }] });
    const open = await request(app).get("/api/admin/reports").set("Authorization", admin);
    expect(open.status).toBe(200);
    expect(open.body.some((report: { reporter: { name: string } }) => report.reporter.name === "Deleted account")).toBe(true);
  });
});
