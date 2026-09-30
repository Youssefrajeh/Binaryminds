import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
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
const aliceAuth = `Bearer ${signToken({ userId: "alice", role: "STUDENT" })}`;

const group = {
  id: "sg1",
  name: "Midterm prep",
  courseCode: "INFO5103",
  description: null,
  createdById: "alice",
  createdAt: new Date("2026-09-20T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  prisma.studyGroupMember.findMany.mockResolvedValue([]);
  prisma.conversation.findMany.mockResolvedValue([]);
});

describe("POST /api/study-groups", () => {
  it("validates input", async () => {
    const res = await request(app).post("/api/study-groups").set("Authorization", aliceAuth).send({ name: "", courseCode: "" });
    expect(res.status).toBe(400);
    expect(prisma.studyGroup.create).not.toHaveBeenCalled();
  });

  it("creates the group, adds the creator, and creates its group chat", async () => {
    prisma.studyGroup.create.mockResolvedValue(group);
    prisma.conversation.create.mockResolvedValue({ id: "c-group" });
    prisma.studyGroup.findUniqueOrThrow.mockResolvedValue({ ...group, _count: { members: 1 } });
    prisma.studyGroupMember.findMany.mockResolvedValue([{ studyGroupId: "sg1", userId: "alice" }]);
    prisma.conversation.findMany.mockResolvedValue([{ id: "c-group", studyGroupId: "sg1" }]);

    const res = await request(app)
      .post("/api/study-groups")
      .set("Authorization", aliceAuth)
      .send({ name: "Midterm prep", courseCode: "info5103" });

    expect(res.status).toBe(201);
    expect(prisma.studyGroup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ courseCode: "INFO5103", createdById: "alice", members: { create: { userId: "alice" } } }),
    });
    expect(prisma.conversation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "GROUP",
        status: "ACCEPTED",
        studyGroupId: "sg1",
        directKey: "group:sg1",
        participants: { create: { userId: "alice", lastReadAt: expect.any(Date) } },
      }),
    });
    expect(res.body).toMatchObject({ isMember: true, memberCount: 1, conversationId: "c-group" });
  });
});

describe("POST /api/study-groups/:id/join", () => {
  it("returns 404 for unknown groups", async () => {
    prisma.studyGroup.findUnique.mockResolvedValue(null);
    const res = await request(app).post("/api/study-groups/nope/join").set("Authorization", aliceAuth);
    expect(res.status).toBe(404);
  });

  it("adds the member to the group chat", async () => {
    prisma.studyGroup.findUnique.mockResolvedValue(group);
    prisma.conversation.findUnique.mockResolvedValue({ id: "c-group" });
    prisma.participant.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/api/study-groups/sg1/join").set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe("c-group");
    expect(prisma.participant.create).toHaveBeenCalledWith({
      data: { conversationId: "c-group", userId: "alice", lastReadAt: expect.any(Date) },
    });
  });
});

describe("POST /api/study-groups/:id/leave", () => {
  it("returns 404 when not a member", async () => {
    prisma.studyGroupMember.deleteMany.mockResolvedValue({ count: 0 });
    const res = await request(app).post("/api/study-groups/sg1/leave").set("Authorization", aliceAuth);
    expect(res.status).toBe(404);
  });

  it("removes the member from the group chat", async () => {
    prisma.studyGroupMember.deleteMany.mockResolvedValue({ count: 1 });
    prisma.conversation.findUnique.mockResolvedValue({ id: "c-group" });
    prisma.studyGroupMember.count.mockResolvedValue(2);

    const res = await request(app).post("/api/study-groups/sg1/leave").set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    expect(prisma.participant.deleteMany).toHaveBeenCalledWith({ where: { conversationId: "c-group", userId: "alice" } });
    expect(prisma.studyGroup.delete).not.toHaveBeenCalled();
  });

  it("deletes the group and its chat when the last member leaves", async () => {
    prisma.studyGroupMember.deleteMany.mockResolvedValue({ count: 1 });
    prisma.conversation.findUnique.mockResolvedValue({ id: "c-group" });
    prisma.studyGroupMember.count.mockResolvedValue(0);

    const res = await request(app).post("/api/study-groups/sg1/leave").set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    expect(prisma.message.deleteMany).toHaveBeenCalledWith({ where: { conversationId: "c-group" } });
    expect(prisma.conversation.delete).toHaveBeenCalledWith({ where: { id: "c-group" } });
    expect(prisma.studyGroup.delete).toHaveBeenCalledWith({ where: { id: "sg1" } });
  });
});
