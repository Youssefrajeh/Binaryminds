import type { Prisma, StudyGroup } from "@prisma/client";
import { prisma } from "./prisma.js";
import { groupKeyFor } from "./conversations.js";

/* ------------------------------------------------------------------ */
/*  Keep each study group's chat in step with its membership           */
/* ------------------------------------------------------------------ */

/** Creates the group's conversation with the creator as its first member */
export async function createGroupConversation(group: StudyGroup, creatorId: string, db: Prisma.TransactionClient = prisma) {
  return db.conversation.create({
    data: {
      type: "GROUP",
      status: "ACCEPTED",
      name: group.name,
      studyGroupId: group.id,
      directKey: groupKeyFor(group.id),
      participants: { create: { userId: creatorId, lastReadAt: new Date() } },
    },
  });

}

export class StudyGroupError extends Error {
  readonly status = 404;
}

async function lockGroup(db: Prisma.TransactionClient, id: string) {
  // MongoDB increments of missing/null fields need an explicit starting value.
  await db.studyGroup.updateMany({
    where: { id, OR: [{ membershipVersion: { isSet: false } }, { membershipVersion: null }] },
    data: { membershipVersion: 0 },
  });
  return db.studyGroup.update({ where: { id }, data: { membershipVersion: { increment: 1 } } });
}

async function membershipTransaction<T>(work: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work); }
    catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (attempt < 3 && (code === "P2034" || code === "P2002")) continue;
      if (code === "P2025") throw new StudyGroupError("Study group not found");
      throw err;
    }
  }
}

/** A shared group write serializes joins/leaves, including last-member deletion. */
export async function joinStudyGroup(studyGroupId: string, userId: string) {
  return membershipTransaction(async (db) => {
    const group = await lockGroup(db, studyGroupId);
    await db.studyGroupMember.upsert({
      where: { studyGroupId_userId: { studyGroupId, userId } },
      create: { studyGroupId, userId }, update: {},
    });
    let conversation = await db.conversation.findUnique({ where: { directKey: groupKeyFor(studyGroupId) } });
    if (!conversation) {
      conversation = await createGroupConversation(group, userId, db);
      // Repair older groups whose chat is missing without excluding existing members.
      const members = await db.studyGroupMember.findMany({ where: { studyGroupId, userId: { not: userId } }, select: { userId: true } });
      if (members.length) await db.participant.createMany({ data: members.map((member) => ({ conversationId: conversation!.id, userId: member.userId, lastReadAt: new Date() })) });
    } else {
      await db.participant.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId } },
        create: { conversationId: conversation.id, userId, lastReadAt: new Date() }, update: {},
      });
    }
    return conversation;
  });
}

export async function leaveStudyGroup(studyGroupId: string, userId: string) {
  return membershipTransaction(async (db) => {
    await lockGroup(db, studyGroupId);
    const { count } = await db.studyGroupMember.deleteMany({ where: { studyGroupId, userId } });
    if (!count) throw new StudyGroupError("You are not a member of this study group");
    const conversation = await db.conversation.findUnique({ where: { directKey: groupKeyFor(studyGroupId) } });
    if (conversation) await db.participant.deleteMany({ where: { conversationId: conversation.id, userId } });
    const remaining = await db.studyGroupMember.count({ where: { studyGroupId } });
    if (remaining === 0) {
      if (conversation) {
        await db.message.deleteMany({ where: { conversationId: conversation.id } });
        await db.participant.deleteMany({ where: { conversationId: conversation.id } });
        await db.conversation.delete({ where: { id: conversation.id } });
      }
      await db.studyGroup.delete({ where: { id: studyGroupId } });
    }
    return { conversationId: conversation?.id ?? null, deleted: remaining === 0 };
  });
}
