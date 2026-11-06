import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { sharedFileUrl } from "@campushub/shared";
import { createApp } from "../app.js";
import { signToken } from "../lib/jwt.js";
import { cleanFileName, parseUpload } from "../lib/files.js";
import { prisma as client } from "../lib/prisma.js";
import { attachmentKey, removeReportedContent, reportContent } from "../lib/reportContent.js";
import type { PrismaMock } from "../test/prismaMock.js";

vi.mock("../lib/prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});
const prisma = client as unknown as PrismaMock;
const app = createApp();
const auth = `Bearer ${signToken({ userId: "student", role: "STUDENT" })}`;
const pdf = Buffer.from("%PDF-1.7 notes").toString("base64");
const stored = { id: "f1", uploaderId: "other", conversationId: "c1", messageId: "m1", courseCode: "INFO5103", name: "notes.pdf", mimeType: "application/pdf", size: 14, data: Buffer.from("%PDF-1.7 notes"), createdAt: new Date("2026-11-01"), removedAt: null };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.user.count.mockResolvedValue(1);
  prisma.$transaction.mockImplementation((callback: (db: PrismaMock) => unknown) => callback(prisma));
});

describe("upload validation", () => {
  it("accepts a file whose contents match its type and ignores folders in the name", () => {
    const upload = parseUpload("C:\\fakepath\\notes.PDF", pdf);
    expect(upload).toMatchObject({ name: "notes.PDF", mimeType: "application/pdf", size: 14 });
  });
  it.each([
    ["virus.exe", pdf], ["page.html", Buffer.from("<script>").toString("base64")], ["noextension", pdf],
    ["__proto__.constructor", pdf], ["notes.pdf", Buffer.from("not a pdf").toString("base64")],
    ["photo.png", pdf], ["notes.docx", pdf], ["binary.txt", Buffer.from([65, 0, 66]).toString("base64")],
  ])("rejects %s", (name, data) => {
    expect(typeof parseUpload(name, data)).toBe("string");
  });
  it("rejects files over 5 MB", () => {
    const big = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(5 * 1024 * 1024)]).toString("base64");
    expect(parseUpload("big.pdf", big)).toBe("Files can be at most 5 MB");
  });
  it("shortens long names but keeps the extension", () => {
    const cleaned = cleanFileName(`${"a".repeat(300)}.pdf`);
    expect(cleaned).toHaveLength(120);
    expect(cleaned.endsWith(".pdf")).toBe(true);
  });
});

describe("POST /api/conversations/:id/files", () => {
  const url = "/api/conversations/c1/files";
  function inConversation(conversation: Record<string, unknown>) {
    prisma.participant.findUnique.mockResolvedValue({ id: "p1", conversation: { id: "c1", lastMessage: null, requestedById: null, studyGroupId: null, ...conversation } });
    prisma.participant.findMany.mockResolvedValue([{ userId: "student" }, { userId: "other" }]);
    prisma.message.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "m1", removedAt: null, createdAt: new Date(), ...data }));
    prisma.conversation.update.mockResolvedValue({});
  }

  it("requires sign in", async () => {
    expect((await request(app).post(url).send({ name: "notes.pdf", data: pdf })).status).toBe(401);
  });
  it("adds a study group file to its course library with a link-only message", async () => {
    inConversation({ type: "GROUP", status: "ACCEPTED", studyGroupId: "g1" });
    prisma.studyGroup.findUnique.mockResolvedValue({ courseCode: "INFO5103" });
    const response = await request(app).post(url).set("Authorization", auth).send({ name: "notes.pdf", data: pdf });
    expect(response.status).toBe(201);
    expect(response.body.text).toBe("Shared notes.pdf");
    const created = prisma.sharedFile.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ courseCode: "INFO5103", uploaderId: "student", conversationId: "c1", messageId: "m1", removedAt: null });
    expect(response.body.attachments).toEqual([{ url: sharedFileUrl(created.id), name: "notes.pdf", mimeType: "application/pdf", size: 14 }]);
  });
  it("keeps a direct message file out of the library", async () => {
    inConversation({ type: "DIRECT", status: "ACCEPTED" });
    await request(app).post(url).set("Authorization", auth).send({ name: "notes.pdf", data: pdf, text: "Here you go" });
    expect(prisma.sharedFile.create.mock.calls[0][0].data.courseCode).toBeNull();
    expect(prisma.message.create.mock.calls[0][0].data.text).toBe("Here you go");
  });
  it("blocks files in an unaccepted message request", async () => {
    inConversation({ type: "DIRECT", status: "PENDING" });
    expect((await request(app).post(url).set("Authorization", auth).send({ name: "notes.pdf", data: pdf })).status).toBe(409);
    expect(prisma.sharedFile.create).not.toHaveBeenCalled();
  });
  it("hides conversations the student is not in", async () => {
    prisma.participant.findUnique.mockResolvedValue(null);
    expect((await request(app).post(url).set("Authorization", auth).send({ name: "notes.pdf", data: pdf })).status).toBe(404);
  });
  it("rejects unsafe files before saving anything", async () => {
    expect((await request(app).post(url).set("Authorization", auth).send({ name: "virus.exe", data: pdf })).status).toBe(400);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });
});

describe("course library", () => {
  it("lists only library files, without file contents", async () => {
    prisma.sharedFile.findMany.mockResolvedValue([{ ...stored, data: undefined, uploader: { profile: { displayName: "Sam" } } }]);
    const response = await request(app).get("/api/files?course=info-5103&search=notes").set("Authorization", auth);
    expect(response.status).toBe(200);
    expect(response.body[0]).toMatchObject({ id: "f1", courseCode: "INFO5103", uploader: { id: "other", displayName: "Sam" } });
    const args = prisma.sharedFile.findMany.mock.calls[0][0];
    expect(args.where).toMatchObject({ courseCode: "INFO5103", removedAt: null, name: { contains: "notes", mode: "insensitive" } });
    expect(args.select).not.toHaveProperty("data");
    expect(response.headers["x-has-more"]).toBe("false");
  });
  it("groups files by course", async () => {
    prisma.sharedFile.groupBy.mockResolvedValue([{ courseCode: "INFO5103", _count: { _all: 2 } }]);
    const response = await request(app).get("/api/files/courses").set("Authorization", auth);
    expect(response.body).toEqual([{ courseCode: "INFO5103", fileCount: 2 }]);
  });
});

describe("GET /api/files/:id/download", () => {
  const url = "/api/files/f1/download";
  const direct = { ...stored, courseCode: null };

  it("sends a library file as a forced download to any signed-in student", async () => {
    prisma.sharedFile.findUnique.mockResolvedValue(stored);
    const response = await request(app).get(url).set("Authorization", auth);
    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).toContain("attachment");
    expect(response.headers["content-type"]).toContain("application/octet-stream");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(prisma.participant.findUnique).not.toHaveBeenCalled();
  });
  it("requires sign in", async () => {
    expect((await request(app).get(url)).status).toBe(401);
  });
  it("hides removed files", async () => {
    prisma.sharedFile.findUnique.mockResolvedValue({ ...stored, removedAt: new Date() });
    expect((await request(app).get(url).set("Authorization", auth)).status).toBe(404);
  });
  it("lets conversation members open direct message files", async () => {
    prisma.sharedFile.findUnique.mockResolvedValue(direct);
    prisma.participant.findUnique.mockResolvedValue({ id: "p1" });
    expect((await request(app).get(url).set("Authorization", auth)).status).toBe(200);
  });
  it("hides direct message files from other students", async () => {
    prisma.sharedFile.findUnique.mockResolvedValue(direct);
    prisma.participant.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ role: "STUDENT" });
    expect((await request(app).get(url).set("Authorization", auth)).status).toBe(404);
  });
  it("lets an administrator open a direct message file only once it is reported", async () => {
    prisma.sharedFile.findUnique.mockResolvedValue(direct);
    prisma.participant.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ role: "ADMINISTRATOR" });
    prisma.report.findFirst.mockResolvedValue(null);
    expect((await request(app).get(url).set("Authorization", auth)).status).toBe(404);
    prisma.report.findFirst.mockResolvedValue({ id: "r1" });
    expect((await request(app).get(url).set("Authorization", auth)).status).toBe(200);
    const key = attachmentKey({ url: sharedFileUrl("f1"), name: stored.name, mimeType: stored.mimeType, size: stored.size });
    expect(prisma.report.findFirst.mock.calls[0][0].where.fileKey).toBe(key);
  });
});

describe("reporting shared files", () => {
  const attachment = { url: sharedFileUrl("f1"), name: "notes.pdf", mimeType: "application/pdf", size: 14 };
  const message = { id: "m1", conversationId: "c1", senderId: "other", text: "Shared notes.pdf", attachments: [attachment], removedAt: null };
  const db = prisma as never;

  it("lets a non-member report a library file", async () => {
    prisma.message.findUnique.mockResolvedValue(message);
    prisma.participant.findUnique.mockResolvedValue(null);
    prisma.sharedFile.findUnique.mockResolvedValue({ courseCode: "INFO5103", removedAt: null });
    const result = await reportContent(db, "student", "FILE", "m1", 0);
    expect(result.fileKey).toBe(attachmentKey(attachment));
  });
  it("does not let a non-member report a private file or message", async () => {
    prisma.message.findUnique.mockResolvedValue(message);
    prisma.participant.findUnique.mockResolvedValue(null);
    prisma.sharedFile.findUnique.mockResolvedValue({ courseCode: null, removedAt: null });
    await expect(reportContent(db, "student", "FILE", "m1", 0)).rejects.toThrow("no longer available");
    await expect(reportContent(db, "student", "MESSAGE", "m1")).rejects.toThrow("no longer available");
  });
  it.each(["FILE", "MESSAGE"])("stops downloads when a reported %s is removed", async (targetType) => {
    prisma.message.findUnique.mockResolvedValue(message);
    prisma.message.update.mockResolvedValue(message);
    prisma.message.findFirst.mockResolvedValue(null);
    await removeReportedContent(db, { targetType, targetId: "m1", fileKey: attachmentKey(attachment) });
    expect(prisma.sharedFile.updateMany.mock.calls[0][0].where).toEqual({ id: { in: ["f1"] } });
  });
});
