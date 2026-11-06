import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { signToken } from "../lib/jwt.js";

let app: ReturnType<typeof import("../app.js").createApp>;
let prisma: PrismaClient;
let database: MongoMemoryReplSet | undefined;
const bearer = (userId: string, role = "STUDENT") => `Bearer ${signToken({ userId, role: role as "STUDENT" })}`;
const contents = Buffer.from("%PDF-1.7 week one notes");
const pdf = contents.toString("base64");

beforeAll(async () => {
  // Only this disposable localhost database is used, never a developer/Atlas DB.
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const databaseUrl = database.getUri("campushub_files_test");
  const require = createRequire(import.meta.url);
  await promisify(execFile)(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push",
    "--schema", fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)), "--skip-generate"],
  { env: { ...process.env, DATABASE_URL: databaseUrl }, timeout: 60000 });
  prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  vi.doMock("../lib/prisma.js", () => ({ prisma }));
  const { createApp } = await import("../app.js");
  app = createApp();
  for (const id of ["member", "friend", "outsider"]) {
    await prisma.user.create({ data: {
      id, email: `${id}@fanshaweonline.ca`, passwordHash: "unused-in-this-test", status: "ACTIVE", emailVerifiedAt: new Date(),
      profile: { create: { displayName: id, interests: [] } },
    } });
  }
  await prisma.studyGroup.create({ data: { id: "group", name: "Algorithms", courseCode: "INFO5103", createdById: "member" } });
  await prisma.conversation.create({ data: {
    id: "group-chat", type: "GROUP", status: "ACCEPTED", studyGroupId: "group", directKey: "group:group", name: "Algorithms",
    participants: { create: [{ userId: "member" }] },
  } });
  await prisma.conversation.create({ data: {
    id: "dm", type: "DIRECT", status: "ACCEPTED", directKey: "direct:friend_member",
    participants: { create: [{ userId: "member" }, { userId: "friend" }] },
  } });
}, 180000);

beforeEach(async () => {
  await prisma.sharedFile.deleteMany();
  await prisma.message.deleteMany();
});

afterAll(async () => {
  await prisma?.$disconnect();
  await database?.stop();
  vi.doUnmock("../lib/prisma.js");
}, 30000);

const share = (conversationId: string, name = "week1.pdf") =>
  request(app).post(`/api/conversations/${conversationId}/files`).set("Authorization", bearer("member")).send({ name, data: pdf });

describe("shared files against real MongoDB", () => {
  it("stores the contents apart from the message and returns them unchanged", async () => {
    const shared = await share("group-chat");
    expect(shared.status).toBe(201);
    const message = await prisma.message.findUniqueOrThrow({ where: { id: shared.body.id } });
    expect(JSON.stringify(message)).not.toContain(pdf);

    const download = await request(app).get(shared.body.attachments[0].url).set("Authorization", bearer("outsider")).buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => done(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(Buffer.compare(download.body as Buffer, contents)).toBe(0);
  });

  it("shows only study group files in the library and its course list", async () => {
    await share("group-chat");
    await share("dm", "private.pdf");
    const auth = bearer("outsider");
    const list = await request(app).get("/api/files").set("Authorization", auth);
    expect(list.body.map((file: { name: string }) => file.name)).toEqual(["week1.pdf"]);
    expect(list.body[0]).toMatchObject({ courseCode: "INFO5103", uploader: { id: "member", displayName: "member" } });
    expect((await request(app).get("/api/files/courses").set("Authorization", auth)).body).toEqual([{ courseCode: "INFO5103", fileCount: 1 }]);
    expect((await request(app).get("/api/files?course=info-5103&search=WEEK").set("Authorization", auth)).body).toHaveLength(1);
    expect((await request(app).get("/api/files?course=INFO9999").set("Authorization", auth)).body).toHaveLength(0);
  });

  it("keeps direct message files private to the conversation", async () => {
    const url = (await share("dm", "private.pdf")).body.attachments[0].url;
    expect((await request(app).get(url).set("Authorization", bearer("friend"))).status).toBe(200);
    expect((await request(app).get(url).set("Authorization", bearer("outsider"))).status).toBe(404);
  });

  it("leaves nothing behind when the message cannot be sent", async () => {
    expect((await share("missing-chat")).status).toBe(404);
    expect(await prisma.sharedFile.count()).toBe(0);
  });

  it("deletes a chat's files along with the chat", async () => {
    await prisma.conversation.create({ data: {
      id: "short-lived", type: "GROUP", status: "ACCEPTED", directKey: "group:short-lived",
      participants: { create: [{ userId: "member" }] },
    } });
    expect((await share("short-lived")).status).toBe(201);
    await prisma.message.deleteMany({ where: { conversationId: "short-lived" } });
    await prisma.participant.deleteMany({ where: { conversationId: "short-lived" } });
    await prisma.conversation.delete({ where: { id: "short-lived" } });
    expect(await prisma.sharedFile.count()).toBe(0);
  });

  it("stops serving and listing a file once it is removed", async () => {
    const shared = await share("group-chat");
    await prisma.sharedFile.updateMany({ data: { removedAt: new Date() } });
    const auth = bearer("outsider");
    expect((await request(app).get(shared.body.attachments[0].url).set("Authorization", auth)).status).toBe(404);
    expect((await request(app).get("/api/files").set("Authorization", auth)).body).toEqual([]);
    expect((await request(app).get("/api/files/courses").set("Authorization", auth)).body).toEqual([]);
  });
});
