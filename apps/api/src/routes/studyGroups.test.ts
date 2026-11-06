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

// Member counts skip memberships of deleted or inactive accounts, matching the members list
const countedMembers = { _count: { select: { members: { where: { user: { is: { status: "ACTIVE" } } } } } } };

const group = {
  id: "sg1",
  name: "Midterm prep",
  courseCode: "INFO5103",
  description: null,
  createdById: "alice",
  createdAt: new Date("2026-09-20T00:00:00Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  prisma.user.count.mockResolvedValue(1);
  prisma.$transaction.mockImplementation((callback) => callback(prisma));
  prisma.studyGroup.update.mockResolvedValue(group);
  prisma.studyGroup.updateMany.mockResolvedValue({ count: 0 });
  prisma.studyGroupMember.findMany.mockResolvedValue([]);
  prisma.conversation.findMany.mockResolvedValue([]);
});

describe("POST /api/study-groups", () => {
  it("requires an active signed-in account", async () => {
    expect((await request(app).post("/api/study-groups").send({ name: "Group", courseCode: "INFO5103", description: "Study together" })).status).toBe(401);
    prisma.user.count.mockResolvedValueOnce(0);
    expect((await request(app).post("/api/study-groups").set("Authorization", aliceAuth).send({ name: "Group", courseCode: "INFO5103", description: "Study together" })).status).toBe(401);
    expect(prisma.studyGroup.create).not.toHaveBeenCalled();
  });

  it("validates input", async () => {
    const res = await request(app).post("/api/study-groups").set("Authorization", aliceAuth).send({ name: "", courseCode: "" });
    expect(res.status).toBe(400);
    expect(prisma.studyGroup.create).not.toHaveBeenCalled();
  });

  it("creates the group, adds the creator, and creates its group chat", async () => {
    prisma.studyGroup.create.mockResolvedValue({ ...group, description: "Review together", _count: { members: 1 } });
    prisma.conversation.create.mockResolvedValue({ id: "c-group" });

    const res = await request(app)
      .post("/api/study-groups")
      .set("Authorization", aliceAuth)
      .send({ name: " Midterm prep ", courseCode: "info-5103", description: " Review together ", createdById: "someone-else" });

    expect(res.status).toBe(201);
    expect(prisma.studyGroup.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ courseCode: "INFO5103", createdById: "alice", members: { create: { userId: "alice" } } }),
      include: countedMembers,
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
    expect(res.body).toMatchObject({ name: "Midterm prep", description: "Review together", isMember: true, memberCount: 1, conversationId: "c-group" });
    expect(prisma.studyGroupMember.findMany).not.toHaveBeenCalled();
    expect(prisma.studyGroup.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it.each([
    { name: " " }, { courseCode: " " }, { description: " " }, { description: null }, { description: undefined },
    { name: "x".repeat(81) }, { courseCode: "x".repeat(31) }, { courseCode: "<script>" }, { courseCode: "--" }, { description: "x".repeat(301) },
    { courseCode: "1105" }, { courseCode: "INFO" }, { courseCode: "INFO-51" }, { courseCode: "INFO--5103" }, { courseCode: "5103-INFO" },
  ])("rejects invalid group fields: %j", async (fields) => {
    const res = await request(app).post("/api/study-groups").set("Authorization", aliceAuth).send({ name: "Group", courseCode: "INFO5103", description: "Study together", ...fields });
    expect(res.status).toBe(400);
    expect(prisma.studyGroup.create).not.toHaveBeenCalled();
  });

  it.each([["INFO-5103", "INFO5103"], ["info5103", "INFO5103"], ["Info 5103", "INFO5103"], [" comp-1234a ", "COMP1234A"]])("accepts course code %j and stores it as %s", async (input, stored) => {
    prisma.studyGroup.create.mockResolvedValue({ ...group, courseCode: stored, description: "Review", _count: { members: 1 } });
    prisma.conversation.create.mockResolvedValue({ id: "c-group" });
    const res = await request(app).post("/api/study-groups").set("Authorization", aliceAuth).send({ name: "Group", courseCode: input, description: "Review" });
    expect(res.status).toBe(201);
    expect(prisma.studyGroup.create.mock.calls[0][0].data.courseCode).toBe(stored);
  });

  it.each([["name", "Group name is required"], ["courseCode", "Course code is required"], ["description", "Description is required"]])("names a missing %s", async (field, message) => {
    const body: Record<string, string> = { name: "Group", courseCode: "INFO5103", description: "Review" };
    delete body[field];
    const res = await request(app).post("/api/study-groups").set("Authorization", aliceAuth).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(message);
  });

  it("explains the expected course code format", async () => {
    const res = await request(app).post("/api/study-groups").set("Authorization", aliceAuth).send({ name: "Group", courseCode: "1105", description: "Review" });
    expect(res.body.error).toBe("Use a course code such as INFO-5103");
  });

  it("returns an error if the atomic group/chat transaction fails", async () => {
    prisma.$transaction.mockRejectedValueOnce(new Error("Database unavailable"));
    const res = await request(app).post("/api/study-groups").set("Authorization", aliceAuth).send({ name: "Group", courseCode: "INFO5103", description: "Study together" });
    expect(res.status).toBe(500);
    expect(prisma.studyGroup.create).not.toHaveBeenCalled();
  });
});

describe("GET /api/study-groups", () => {
  it("bounds list queries and rejects invalid pages", async () => {
    prisma.studyGroup.findMany.mockResolvedValue([]);
    expect((await request(app).get("/api/study-groups?page=2").set("Authorization", aliceAuth)).status).toBe(200);
    expect(prisma.studyGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 21 }));
    expect((await request(app).get("/api/study-groups?page=0").set("Authorization", aliceAuth)).status).toBe(400);
  });

  it("returns empty lists without unnecessary membership or chat queries", async () => {
    prisma.studyGroup.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/study-groups").set("Authorization", aliceAuth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(prisma.studyGroupMember.findMany).not.toHaveBeenCalled();
    expect(prisma.conversation.findMany).not.toHaveBeenCalled();
  });

  it("counts members with the same filter as the members list", async () => {
    prisma.studyGroup.findMany.mockResolvedValue([{ ...group, _count: { members: 1 } }]);
    const res = await request(app).get("/api/study-groups").set("Authorization", aliceAuth);
    expect(prisma.studyGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: countedMembers }));
    expect(res.body[0].memberCount).toBe(1);
  });

  it("shows saved group details but hides chat ids from nonmembers", async () => {
    prisma.studyGroup.findMany.mockResolvedValue([{ ...group, _count: { members: 1 } }]);
    prisma.conversation.findMany.mockResolvedValue([{ id: "c-group", studyGroupId: "sg1" }]);
    const res = await request(app).get("/api/study-groups").set("Authorization", aliceAuth);
    expect(res.body[0]).toMatchObject({ name: group.name, courseCode: group.courseCode, description: null, isMember: false, conversationId: null });
  });
});

describe("POST /api/study-groups/:id/join", () => {
  it("returns 404 for unknown groups", async () => {
    prisma.studyGroup.update.mockRejectedValueOnce({ code: "P2025" });
    const res = await request(app).post("/api/study-groups/nope/join").set("Authorization", aliceAuth);
    expect(res.status).toBe(404);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("adds the member to the group chat", async () => {
    prisma.conversation.findUnique.mockResolvedValue({ id: "c-group" });
    prisma.participant.findUnique.mockResolvedValue(null);

    const res = await request(app).post("/api/study-groups/sg1/join").set("Authorization", aliceAuth);

    expect(res.status).toBe(200);
    expect(res.body.conversationId).toBe("c-group");
    expect(prisma.participant.upsert).toHaveBeenCalledWith({
      where: { conversationId_userId: { conversationId: "c-group", userId: "alice" } },
      create: { conversationId: "c-group", userId: "alice", lastReadAt: expect.any(Date) }, update: {},
    });
    expect(prisma.studyGroupMember.upsert).toHaveBeenCalledWith({ where: { studyGroupId_userId: { studyGroupId: "sg1", userId: "alice" } }, create: { studyGroupId: "sg1", userId: "alice" }, update: {} });
  });

  it("retries write conflicts without trusting a submitted membership id", async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: "P2034" });
    prisma.conversation.findUnique.mockResolvedValue({ id: "c-group" });
    const res = await request(app).post("/api/study-groups/sg1/join").set("Authorization", aliceAuth).send({ userId: "other" });
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.studyGroupMember.upsert.mock.calls[0][0].create.userId).toBe("alice");
  });

  it("recovers when transaction contention outlasts the first four attempts", async () => {
    for (let attempt = 0; attempt < 4; attempt++) prisma.$transaction.mockRejectedValueOnce({ code: "P2034" });
    prisma.conversation.findUnique.mockResolvedValue({ id: "c-group" });
    const response = await request(app).post("/api/study-groups/sg1/join").set("Authorization", aliceAuth);
    expect(response.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledTimes(5);
    expect(prisma.studyGroupMember.upsert).toHaveBeenCalledTimes(1);
  });

  it("repairs a missing legacy group chat for all existing members", async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);
    prisma.conversation.create.mockResolvedValue({ id: "new-chat" });
    prisma.studyGroupMember.findMany.mockResolvedValue([{ userId: "existing" }]);
    expect((await request(app).post("/api/study-groups/sg1/join").set("Authorization", aliceAuth)).status).toBe(200);
    expect(prisma.participant.createMany).toHaveBeenCalledWith({ data: [{ conversationId: "new-chat", userId: "existing", lastReadAt: expect.any(Date) }] });
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

  it("does not remove chat membership when group membership is missing", async () => {
    prisma.studyGroupMember.deleteMany.mockResolvedValue({ count: 0 });
    expect((await request(app).post("/api/study-groups/sg1/leave").set("Authorization", aliceAuth)).status).toBe(404);
    expect(prisma.participant.deleteMany).not.toHaveBeenCalled();
    expect(prisma.studyGroup.delete).not.toHaveBeenCalled();
  });
});

describe("group details and public member lists", () => {
  it.each(["/sg1", "/sg1/members", "/sg1/join", "/sg1/leave"])("requires authentication for %s", async (path) => {
    const method = path.endsWith("join") || path.endsWith("leave") ? "post" : "get";
    expect((await request(app)[method](`/api/study-groups${path}`)).status).toBe(401);
  });

  it.each(["/sg1", "/sg1/members"])("returns 404 for missing groups at %s", async (path) => {
    prisma.studyGroup.findUnique.mockResolvedValue(null);
    expect((await request(app).get(`/api/study-groups${path}`).set("Authorization", aliceAuth)).status).toBe(404);
  });

  it("returns group details with chat access only for members", async () => {
    prisma.studyGroup.findUnique.mockResolvedValue({ ...group, _count: { members: 1 } });
    prisma.conversation.findMany.mockResolvedValue([{ id: "chat", studyGroupId: "sg1" }]);
    const publicView = await request(app).get("/api/study-groups/sg1").set("Authorization", aliceAuth);
    expect(publicView.body).toMatchObject({ id: "sg1", createdById: "alice", isMember: false, conversationId: null });
    prisma.studyGroupMember.findMany.mockResolvedValue([{ studyGroupId: "sg1" }]);
    const memberView = await request(app).get("/api/study-groups/sg1").set("Authorization", aliceAuth);
    expect(memberView.body).toMatchObject({ isMember: true, conversationId: "chat" });
    expect(memberView.body).not.toHaveProperty("membershipVersion");
    expect(prisma.studyGroup.findUnique).toHaveBeenCalledWith({ where: { id: "sg1" }, include: countedMembers });
  });

  it("returns only public member fields with pagination and excludes inactive/deleted accounts", async () => {
    prisma.studyGroup.findUnique.mockResolvedValue(group);
    const joinedAt = new Date("2026-10-01");
    prisma.studyGroupMember.findMany.mockResolvedValue(Array.from({ length: 21 }, () => ({ joinedAt, user: { id: "alice", email: "alice@fanshaweonline.ca", passwordHash: "secret", profile: { displayName: "Alice", program: "Computing", yearOfStudy: 2 } } })));
    const res = await request(app).get("/api/study-groups/sg1/members?page=2").set("Authorization", aliceAuth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(20);
    expect(res.headers["x-has-more"]).toBe("true");
    expect(res.body[0]).toEqual({ id: "alice", displayName: "Alice", avatarUrl: null, program: "Computing", yearOfStudy: 2, joinedAt: joinedAt.toISOString(), isCreator: true });
    expect(prisma.studyGroupMember.findMany.mock.calls[0][0]).toMatchObject({ where: { studyGroupId: "sg1", user: { is: { status: "ACTIVE" } } }, skip: 20, take: 21 });
  });

  it("rejects invalid member pagination", async () => {
    expect((await request(app).get("/api/study-groups/sg1/members?page=0").set("Authorization", aliceAuth)).status).toBe(400);
    expect(prisma.studyGroup.findUnique).not.toHaveBeenCalled();
  });
});
