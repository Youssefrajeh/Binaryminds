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
const auth = `Bearer ${signToken({ userId: "student", role: "STUDENT" })}`;
const adminAuth = `Bearer ${signToken({ userId: "student", role: "ADMINISTRATOR" })}`;
const body = { targetType: "LISTING", targetId: "listing", reason: "SCAM" };
const report = { id: "r1", targetType: "LISTING", targetId: "listing", status: "OPEN", fileKey: null };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.user.count.mockResolvedValue(1);
  prisma.user.findUnique.mockResolvedValue({ role: "ADMINISTRATOR", status: "ACTIVE" });
  prisma.user.findMany.mockResolvedValue([]);
  prisma.listing.findUnique.mockResolvedValue({ id: "listing", sellerId: "other", title: "Textbook", description: "Almost new", status: "ACTIVE" });
  prisma.report.findFirst.mockResolvedValue(null);
  prisma.report.create.mockResolvedValue({ id: "r1", status: "OPEN" });
  prisma.report.findUnique.mockResolvedValue(report);
  prisma.report.updateMany.mockResolvedValue({ count: 1 });
  prisma.report.findMany.mockResolvedValue([]);
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
});

describe("student reporting", () => {
  it("requires a session", async () => {
    expect((await request(app).post("/api/reports").send(body)).status).toBe(401);
  });
  it("stores the authenticated reporter and a server-built snapshot", async () => {
    const response = await request(app).post("/api/reports").set("Authorization", auth).send({ ...body, reporterId: "forged", status: "RESOLVED", snapshot: { text: "forged" }, note: "  Please review  " });
    expect(response.status).toBe(201);
    expect(prisma.report.create.mock.calls[0][0].data).toMatchObject({ reporterId: "student", reason: "SCAM", note: "Please review", snapshot: { title: "Textbook", text: "Almost new", authorId: "other" } });
    expect(prisma.report.create.mock.calls[0][0].data).not.toHaveProperty("status");
    expect(response.body).toEqual({ id: "r1", status: "OPEN" });
  });
  it.each([{ reason: "" }, { reason: "made up" }, { note: "x".repeat(1001) }, { targetType: "USER" }, { targetId: "" }, { attachmentIndex: 0 }, { targetType: "FILE" }])("rejects invalid report input %j", async (patch) => {
    expect((await request(app).post("/api/reports").set("Authorization", auth).send({ ...body, ...patch })).status).toBe(400);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });
  it("reuses an existing report from the same student, whatever its status", async () => {
    prisma.report.findFirst.mockResolvedValue({ id: "existing", status: "DISMISSED" });
    const response = await request(app).post("/api/reports").set("Authorization", auth).send(body);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: "existing", alreadyReported: true });
    expect(prisma.report.create).not.toHaveBeenCalled();
    expect(prisma.report.findFirst.mock.calls[0][0].where).not.toHaveProperty("status");
  });
  it("tells the form whether this student already reported the content", async () => {
    expect((await request(app).get("/api/reports/status").query({ targetType: "LISTING", targetId: "listing" }).set("Authorization", auth)).body).toEqual({ reported: false });
    prisma.report.findFirst.mockResolvedValue({ id: "existing" });
    expect((await request(app).get("/api/reports/status").query({ targetType: "LISTING", targetId: "listing" }).set("Authorization", auth)).body).toEqual({ reported: true });
    expect(prisma.report.findFirst.mock.calls[1][0].where).toMatchObject({ reporterId: "student", targetType: "LISTING", targetId: "listing" });
    expect((await request(app).get("/api/reports/status").query({ targetType: "USER", targetId: "x" }).set("Authorization", auth)).status).toBe(400);
    expect((await request(app).get("/api/reports/status").query({ targetType: "LISTING", targetId: "listing" })).status).toBe(401);
  });
  it("rejects self-reporting", async () => {
    prisma.listing.findUnique.mockResolvedValue({ sellerId: "student", title: "Own listing", description: "Own", status: "ACTIVE" });
    expect((await request(app).post("/api/reports").set("Authorization", auth).send(body)).status).toBe(400);
  });
  it("rejects removed or missing content", async () => {
    for (const item of [null, { status: "REMOVED" }]) {
      prisma.listing.findUnique.mockResolvedValue(item);
      expect((await request(app).post("/api/reports").set("Authorization", auth).send(body)).status).toBe(404);
    }
  });
  it("cannot report a private message outside the conversation", async () => {
    prisma.message.findUnique.mockResolvedValue({ id: "m1", conversationId: "private", senderId: "other", text: "Secret", attachments: [] });
    prisma.participant.findUnique.mockResolvedValue(null);
    expect((await request(app).post("/api/reports").set("Authorization", auth).send({ targetType: "MESSAGE", targetId: "m1", reason: "HARASSMENT" })).status).toBe(404);
    expect(prisma.report.create).not.toHaveBeenCalled();
  });
  it("builds a file report from a real attachment and rejects unsafe file links", async () => {
    prisma.message.findUnique.mockResolvedValue({ id: "m1", conversationId: "private", senderId: "other", text: "See the file", attachments: [{ url: "javascript:alert(1)", name: "notes.pdf", mimeType: "application/pdf", size: 200 }] });
    prisma.participant.findUnique.mockResolvedValue({ id: "membership" });
    expect((await request(app).post("/api/reports").set("Authorization", auth).send({ targetType: "FILE", targetId: "m1", attachmentIndex: 0, reason: "OTHER" })).status).toBe(201);
    expect(prisma.report.create.mock.calls[0][0].data).toMatchObject({ fileKey: expect.any(String), snapshot: { title: "notes.pdf", fileUrl: null } });
  });
});

describe("administrator report review", () => {
  it.each(["STUDENT", "ORGANIZER"])("rejects current role %s even with an admin token", async (role) => {
    prisma.user.findUnique.mockResolvedValue({ role, status: "ACTIVE" });
    expect((await request(app).get("/api/admin/reports").set("Authorization", adminAuth)).status).toBe(403);
    expect((await request(app).post("/api/admin/reports/r1/actions").set("Authorization", adminAuth).send({ action: "REMOVE_CONTENT" })).status).toBe(403);
  });
  it("defaults to open reports, bounds pages, and returns no credentials", async () => {
    expect((await request(app).get("/api/admin/reports").set("Authorization", auth)).status).toBe(200);
    expect(prisma.report.findMany.mock.calls[0][0]).toMatchObject({ where: { status: "OPEN" }, take: 21, skip: 0 });
    expect((await request(app).get("/api/admin/reports?limit=51").set("Authorization", auth)).status).toBe(400);
  });
  it.each(["REMOVE_CONTENT", "RESOLVE", "DISMISS"])("saves moderation action %s with its decision", async (action) => {
    const response = await request(app).post("/api/admin/reports/r1/actions").set("Authorization", auth).send({ action, note: "Reviewed" });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe(action === "DISMISS" ? "DISMISSED" : "RESOLVED");
    expect(prisma.moderationAction.create.mock.calls[0][0].data).toMatchObject({ action, note: "Reviewed", adminId: "student", reportId: "r1" });
    if (action === "REMOVE_CONTENT") expect(prisma.listing.updateMany.mock.calls[0][0].data.status).toBe("REMOVED");
    else expect(prisma.listing.updateMany).not.toHaveBeenCalled();
  });
  it("does not overwrite another administrator's decision", async () => {
    prisma.report.updateMany.mockResolvedValue({ count: 0 });
    expect((await request(app).post("/api/admin/reports/r1/actions").set("Authorization", auth).send({ action: "REMOVE_CONTENT" })).status).toBe(409);
    expect(prisma.listing.updateMany).not.toHaveBeenCalled();
    expect(prisma.moderationAction.create).not.toHaveBeenCalled();
  });
});
