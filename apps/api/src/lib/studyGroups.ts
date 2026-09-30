import type { StudyGroup } from "@prisma/client";
import { prisma } from "./prisma.js";
import { groupKeyFor } from "./conversations.js";
import { emitToUsers, removeUserFromConversationRoom } from "../socket/io.js";

/* ------------------------------------------------------------------ */
/*  Keep each study group's chat in step with its membership           */
/* ------------------------------------------------------------------ */

async function findGroupConversation(studyGroupId: string) {
  return prisma.conversation.findUnique({ where: { directKey: groupKeyFor(studyGroupId) } });
}

/** Creates the group's conversation with the creator as its first member */
export async function createGroupConversation(group: StudyGroup, creatorId: string) {
  const conversation = await prisma.conversation.create({
    data: {
      type: "GROUP",
      status: "ACCEPTED",
      name: group.name,
      studyGroupId: group.id,
      directKey: groupKeyFor(group.id),
      participants: { create: { userId: creatorId, lastReadAt: new Date() } },
    },
  });

  emitToUsers([creatorId], "conversation:updated", { conversationId: conversation.id });
  return conversation;
}

/** Adds a new study group member to the group chat (creating the chat if it is missing) */
export async function addMemberToGroupConversation(group: StudyGroup, userId: string) {
  const conversation = await findGroupConversation(group.id);
  if (!conversation) {
    return createGroupConversation(group, userId);
  }

  const existing = await prisma.participant.findUnique({
    where: { conversationId_userId: { conversationId: conversation.id, userId } },
  });
  if (!existing) {
    // Earlier history counts as read so joining doesn't flood the unread badge
    await prisma.participant.create({
      data: { conversationId: conversation.id, userId, lastReadAt: new Date() },
    });
  }

  emitToUsers([userId], "conversation:updated", { conversationId: conversation.id });
  return conversation;
}

/** Removes a member who left the study group from its chat */
export async function removeMemberFromGroupConversation(studyGroupId: string, userId: string) {
  const conversation = await findGroupConversation(studyGroupId);
  if (!conversation) return;

  await prisma.participant.deleteMany({ where: { conversationId: conversation.id, userId } });
  removeUserFromConversationRoom(userId, conversation.id);
  emitToUsers([userId], "conversation:removed", { conversationId: conversation.id });
}

/** Deletes the chat of a study group that no longer exists */
export async function deleteGroupConversation(studyGroupId: string) {
  const conversation = await findGroupConversation(studyGroupId);
  if (!conversation) return;

  await prisma.message.deleteMany({ where: { conversationId: conversation.id } });
  await prisma.participant.deleteMany({ where: { conversationId: conversation.id } });
  await prisma.conversation.delete({ where: { id: conversation.id } });
}
