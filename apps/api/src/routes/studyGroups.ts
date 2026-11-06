import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { COURSE_CODE_HINT, COURSE_CODE_PATTERN, normalizeCourseCode, type StudyGroupDto, type StudyGroupMemberDto } from "@campushub/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { groupKeyFor } from "../lib/conversations.js";
import { emitToUsers, removeUserFromConversationRoom } from "../socket/io.js";
import {
  joinStudyGroup,
  createGroupConversation,
  leaveStudyGroup,
  StudyGroupError,
} from "../lib/studyGroups.js";

export const studyGroupsRouter = Router();

studyGroupsRouter.use(requireAuth);

const createSchema = z.object({
  name: z.string({ error: "Group name is required" }).trim().min(1, "Group name is required").max(80),
  courseCode: z
    .string({ error: "Course code is required" })
    .trim()
    .min(1, "Course code is required")
    .max(30)
    .regex(COURSE_CODE_PATTERN, COURSE_CODE_HINT)
    .transform(normalizeCourseCode),
  description: z.string({ error: "Description is required" }).trim().min(1, "Description is required").max(300),
});
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
const PAGE_SIZE = 20;

// Memberships of deleted or inactive accounts stay in the database; the count and the
// members list both use this filter so they always agree.
const listedMember = { user: { is: { status: "ACTIVE" } } } satisfies Prisma.StudyGroupMemberWhereInput;
const withMemberCount = { _count: { select: { members: { where: listedMember } } } } satisfies Prisma.StudyGroupInclude;

type GroupWithCount = Prisma.StudyGroupGetPayload<{ include: typeof withMemberCount }>;

function toDto(group: GroupWithCount, isMember: boolean, conversationId: string | null): StudyGroupDto {
  return {
    id: group.id,
    name: group.name,
    courseCode: group.courseCode,
    description: group.description,
    memberCount: group._count.members,
    isMember,
    conversationId,
    createdAt: group.createdAt.toISOString(),
  };
}

async function toDtos(groups: GroupWithCount[], userId: string): Promise<StudyGroupDto[]> {
  if (!groups.length) return [];
  const ids = groups.map((g) => g.id);
  const [memberships, conversations] = await Promise.all([
    prisma.studyGroupMember.findMany({ where: { userId, studyGroupId: { in: ids } } }),
    prisma.conversation.findMany({
      where: { directKey: { in: ids.map(groupKeyFor) } },
      select: { id: true, studyGroupId: true },
    }),
  ]);

  const memberOf = new Set(memberships.map((m) => m.studyGroupId));
  const chatFor = new Map(conversations.map((c) => [c.studyGroupId, c.id]));

  return groups.map((group) => toDto(group, memberOf.has(group.id), memberOf.has(group.id) ? chatFor.get(group.id) ?? null : null));
}

/* ------------------------------------------------------------------ */
/*  GET /study-groups                                                  */
/* ------------------------------------------------------------------ */

studyGroupsRouter.get("/", async (req, res) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid study-group page" });
    return;
  }
  try {
    const groups = await prisma.studyGroup.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: withMemberCount,
      skip: (parsed.data.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,
    });

    res.set("X-Has-More", String(groups.length > PAGE_SIZE));
    res.json(await toDtos(groups.slice(0, PAGE_SIZE), req.user!.userId));
  } catch (err) {
    console.error("List study groups error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /study-groups                                                 */
/* ------------------------------------------------------------------ */

studyGroupsRouter.post("/", async (req, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
      return;
    }

    const userId = req.user!.userId;
    const { group, conversation } = await prisma.$transaction(async (db) => {
      const group = await db.studyGroup.create({
        data: { ...parsed.data, createdById: userId, members: { create: { userId } } },
        include: withMemberCount,
      });
      const conversation = await createGroupConversation(group, userId, db);
      return { group, conversation };
    });
    // Notify only after all group/chat writes commit successfully.
    emitToUsers([userId], "conversation:updated", { conversationId: conversation.id });
    res.status(201).json(toDto(group, true, conversation.id));
  } catch (err) {
    console.error("Create study group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /study-groups/:id/join                                        */
/* ------------------------------------------------------------------ */

studyGroupsRouter.post("/:id/join", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const conversation = await joinStudyGroup(req.params.id, userId);
    emitToUsers([userId], "conversation:updated", { conversationId: conversation.id });
    res.json({ message: "Joined study group", conversationId: conversation.id });
  } catch (err) {
    if (err instanceof StudyGroupError) { res.status(err.status).json({ error: err.message }); return; }
    console.error("Join study group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /study-groups/:id/leave                                       */
/* ------------------------------------------------------------------ */

studyGroupsRouter.post("/:id/leave", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const groupId = req.params.id;

    const result = await leaveStudyGroup(groupId, userId);
    if (result.conversationId) {
      removeUserFromConversationRoom(userId, result.conversationId);
      emitToUsers([userId], "conversation:removed", { conversationId: result.conversationId });
    }
    res.json({ message: "Left study group", deleted: result.deleted });
  } catch (err) {
    if (err instanceof StudyGroupError) { res.status(err.status).json({ error: err.message }); return; }
    console.error("Leave study group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

studyGroupsRouter.get("/:id", async (req, res) => {
  try {
    const group = await prisma.studyGroup.findUnique({ where: { id: req.params.id }, include: withMemberCount });
    if (!group) { res.status(404).json({ error: "Study group not found" }); return; }
    const [details] = await toDtos([group], req.user!.userId);
    res.json({ ...details, createdById: group.createdById });
  } catch (err) {
    console.error("Get study group error:", err);
    res.status(500).json({ error: "Could not load the study group" });
  }
});

studyGroupsRouter.get("/:id/members", async (req, res) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid members page" }); return; }
  try {
    const group = await prisma.studyGroup.findUnique({ where: { id: req.params.id }, select: { createdById: true } });
    if (!group) { res.status(404).json({ error: "Study group not found" }); return; }
    const members = await prisma.studyGroupMember.findMany({
      where: { studyGroupId: req.params.id, ...listedMember },
      orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
      skip: (parsed.data.page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1,
      select: { joinedAt: true, user: { select: { id: true, email: true, profile: { select: { displayName: true, avatarUrl: true, program: true, yearOfStudy: true } } } } },
    });
    const result: StudyGroupMemberDto[] = members.slice(0, PAGE_SIZE).map(({ user, joinedAt }) => ({
      id: user.id, displayName: user.profile?.displayName || user.email.split("@")[0],
      avatarUrl: user.profile?.avatarUrl ?? null, program: user.profile?.program ?? null,
      yearOfStudy: user.profile?.yearOfStudy ?? null, joinedAt: joinedAt.toISOString(), isCreator: user.id === group.createdById,
    }));
    res.set("X-Has-More", String(members.length > PAGE_SIZE));
    res.json(result);
  } catch (err) {
    console.error("Get group members error:", err);
    res.status(500).json({ error: "Could not load group members" });
  }
});
