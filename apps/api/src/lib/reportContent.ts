import { createHash } from "node:crypto";
import type { Attachment, Message, Prisma } from "@prisma/client";
import { safeAttachmentUrl, sharedFileIdFrom, type ReportSnapshot, type ReportTarget } from "@campushub/shared";

export class ReportError extends Error {
  constructor(message: string, public status = 404) { super(message); }
}
export function attachmentKey(file: Attachment) {
  return createHash("sha256").update(JSON.stringify([file.url, file.name, file.mimeType, file.size])).digest("hex");
}

async function isLibraryFile(db: Prisma.TransactionClient, file: Attachment) {
  const id = sharedFileIdFrom(file.url);
  if (!id) return false;
  const stored = await db.sharedFile.findUnique({ where: { id }, select: { courseCode: true, removedAt: true } });
  return Boolean(stored?.courseCode && !stored.removedAt);
}

export async function reportContent(db: Prisma.TransactionClient, userId: string, type: ReportTarget, id: string, attachmentIndex?: number) {
  let snapshot: ReportSnapshot;
  let fileKey: string | null = null;
  if (type === "LISTING") {
    const item = await db.listing.findUnique({ where: { id } });
    if (!item || item.status === "REMOVED") throw new ReportError("This listing is no longer available");
    snapshot = { title: item.title, text: item.description, authorId: item.sellerId, href: `/marketplace/${id}` };
  } else if (type === "LOST_FOUND_POST") {
    const item = await db.lostFoundPost.findUnique({ where: { id } });
    if (!item || item.removedAt) throw new ReportError("This post is no longer available");
    snapshot = { title: item.title, text: item.description, authorId: item.authorId, href: "/lost-found", location: item.location };
  } else {
    const message = await db.message.findUnique({ where: { id } });
    if (!message || message.removedAt) throw new ReportError("This content is no longer available");
    const membership = await db.participant.findUnique({ where: { conversationId_userId: { conversationId: message.conversationId, userId } }, select: { id: true } });
    const file = type === "FILE" && attachmentIndex !== undefined ? message.attachments[attachmentIndex] : undefined;
    // Students can report a course library file without having joined its study group.
    if (!membership && !(file && await isLibraryFile(db, file))) throw new ReportError("This content is no longer available");
    if (type === "FILE") {
      if (!file) throw new ReportError("This shared file is no longer available");
      fileKey = attachmentKey(file);
      snapshot = { title: file.name.slice(0, 200), text: message.text.slice(0, 2000), authorId: message.senderId, href: null, fileName: file.name.slice(0, 200), fileUrl: safeAttachmentUrl(file.url), fileSize: file.size };
    } else {
      snapshot = { title: "Reported message", text: message.text.slice(0, 2000), authorId: message.senderId, href: null };
    }
  }
  if (snapshot.authorId === userId) throw new ReportError("You cannot report your own content", 400);
  return { snapshot, fileKey };
}

/** Runs inside the report decision transaction; never deletes conversation history. */
export async function removeReportedContent(db: Prisma.TransactionClient, report: { targetType: string; targetId: string; fileKey: string | null }): Promise<Message | null> {
  const now = new Date();
  if (report.targetType === "LISTING") {
    await db.listing.updateMany({ where: { id: report.targetId, status: { not: "REMOVED" } }, data: { status: "REMOVED", archivedAt: now } });
  } else if (report.targetType === "LOST_FOUND_POST") {
    await db.lostFoundPost.updateMany({ where: { id: report.targetId }, data: { removedAt: now } });
  } else if (report.targetType === "MESSAGE" || report.targetType === "FILE") {
    const message = await db.message.findUnique({ where: { id: report.targetId } });
    if (!message || message.removedAt) return null;
    const attachments = report.targetType === "FILE" ? message.attachments.filter((file) => attachmentKey(file) !== report.fileKey) : [];
    if (report.targetType === "FILE" && attachments.length === message.attachments.length) return null;
    // Detaching alone would leave a stored file downloadable from the course library.
    const removedFiles = message.attachments.filter((file) => !attachments.includes(file)).flatMap((file) => sharedFileIdFrom(file.url) ?? []);
    if (removedFiles.length) await db.sharedFile.updateMany({ where: { id: { in: removedFiles } }, data: { removedAt: now } });
    const updated = await db.message.update({ where: { id: message.id }, data: report.targetType === "MESSAGE"
      ? { text: "[Message removed by an administrator]", attachments: [], removedAt: now }
      : { attachments } });
    if (report.targetType === "MESSAGE") {
      const latest = await db.message.findFirst({ where: { conversationId: message.conversationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      if (latest) await db.conversation.update({ where: { id: message.conversationId }, data: { lastMessage: { text: latest.text.slice(0, 200), senderId: latest.senderId, createdAt: latest.createdAt } } });
    }
    return updated;
  } else throw new ReportError("This content type cannot be removed from this page", 400);
  return null;
}
