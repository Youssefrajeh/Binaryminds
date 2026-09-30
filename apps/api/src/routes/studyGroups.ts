import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { StudyGroupDto } from "@campushub/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { groupKeyFor } from "../lib/conversations.js";
import {
  addMemberToGroupConversation,
  createGroupConversation,
  deleteGroupConversation,
  removeMemberFromGroupConversation,
} from "../lib/studyGroups.js";

export const studyGroupsRouter = Router();

studyGroupsRouter.use(requireAuth);

const createSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(80),
  courseCode: z
    .string()
    .trim()
    .min(2, "Course code is required")
    .max(20)
    .transform((code) => code.toUpperCase()),
  description: z.string().trim().max(300).nullable().optional(),
});

type GroupWithCount = Prisma.StudyGroupGetPayload<{ include: { _count: { select: { members: true } } } }>;

async function toDtos(groups: GroupWithCount[], userId: string): Promise<StudyGroupDto[]> {
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

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    courseCode: g.courseCode,
    description: g.description,
    memberCount: g._count.members,
    isMember: memberOf.has(g.id),
    conversationId: memberOf.has(g.id) ? chatFor.get(g.id) ?? null : null,
    createdAt: g.createdAt.toISOString(),
  }));
}

/* ------------------------------------------------------------------ */
/*  GET /study-groups                                                  */
/* ------------------------------------------------------------------ */

studyGroupsRouter.get("/", async (req, res) => {
  try {
    const groups = await prisma.studyGroup.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    });

    res.json(await toDtos(groups, req.user!.userId));
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
    const group = await prisma.studyGroup.create({
      data: {
        name: parsed.data.name,
        courseCode: parsed.data.courseCode,
        description: parsed.data.description || null,
        createdById: userId,
        members: { create: { userId } },
      },
    });

    await createGroupConversation(group, userId);

    const withCount = await prisma.studyGroup.findUniqueOrThrow({
      where: { id: group.id },
      include: { _count: { select: { members: true } } },
    });
    const [dto] = await toDtos([withCount], userId);
    res.status(201).json(dto);
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
    const group = await prisma.studyGroup.findUnique({ where: { id: req.params.id } });
    if (!group) {
      res.status(404).json({ error: "Study group not found" });
      return;
    }

    try {
      await prisma.studyGroupMember.create({ data: { studyGroupId: group.id, userId } });
    } catch (err) {
      // Already a member — joining again is harmless
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }

    const conversation = await addMemberToGroupConversation(group, userId);
    res.json({ message: "Joined study group", conversationId: conversation.id });
  } catch (err) {
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

    const { count } = await prisma.studyGroupMember.deleteMany({ where: { studyGroupId: groupId, userId } });
    if (count === 0) {
      res.status(404).json({ error: "You are not a member of this study group" });
      return;
    }

    await removeMemberFromGroupConversation(groupId, userId);

    // The last person out closes the group and its chat
    const remaining = await prisma.studyGroupMember.count({ where: { studyGroupId: groupId } });
    if (remaining === 0) {
      await deleteGroupConversation(groupId);
      await prisma.studyGroup.delete({ where: { id: groupId } });
    }

    res.json({ message: "Left study group" });
  } catch (err) {
    console.error("Leave study group error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
