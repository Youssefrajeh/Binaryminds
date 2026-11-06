import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { normalizeCourseCode, sharedFileUrl, type FileCourseDto, type SharedFileDto } from "@campushub/shared";
import { prisma } from "../lib/prisma.js";
import { attachmentKey } from "../lib/reportContent.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const filesRouter = Router();
filesRouter.use(requireAuth);

const PAGE_SIZE = 20;
const listSchema = z.object({
  course: z.string().trim().max(30).transform(normalizeCourseCode).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

// Only study group files carry a course code; direct message files never reach the library.
const libraryFiles = { courseCode: { not: null }, removedAt: null } satisfies Prisma.SharedFileWhereInput;

filesRouter.get("/courses", async (_req, res) => {
  try {
    const groups = await prisma.sharedFile.groupBy({ by: ["courseCode"], where: libraryFiles, _count: { _all: true }, orderBy: { courseCode: "asc" } });
    const courses: FileCourseDto[] = groups.map((group) => ({ courseCode: group.courseCode!, fileCount: group._count._all }));
    res.json(courses);
  } catch (err) {
    console.error("File course list error:", err);
    res.status(500).json({ error: "Could not load courses" });
  }
});

filesRouter.get("/", async (req, res) => {
  const parsed = listSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid file search" });
    return;
  }
  const { course, search, page } = parsed.data;
  try {
    const files = await prisma.sharedFile.findMany({
      where: { ...libraryFiles, ...(course ? { courseCode: course } : {}), ...(search ? { name: { contains: search, mode: "insensitive" } } : {}) },
      // The file contents are left out so a page of results stays small.
      select: { id: true, name: true, mimeType: true, size: true, courseCode: true, messageId: true, createdAt: true, uploaderId: true, uploader: { select: { profile: { select: { displayName: true } } } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE + 1,
    });
    const dtos: SharedFileDto[] = files.slice(0, PAGE_SIZE).map((file) => ({
      id: file.id, name: file.name, mimeType: file.mimeType, size: file.size, courseCode: file.courseCode!, messageId: file.messageId,
      uploader: { id: file.uploaderId, displayName: file.uploader.profile?.displayName ?? "Student" },
      createdAt: file.createdAt.toISOString(),
    }));
    res.set("X-Has-More", String(files.length > PAGE_SIZE));
    res.json(dtos);
  } catch (err) {
    console.error("File list error:", err);
    res.status(500).json({ error: "Could not load files" });
  }
});

filesRouter.get("/:id/download", async (req, res) => {
  const userId = req.user!.userId;
  try {
    const file = await prisma.sharedFile.findUnique({ where: { id: req.params.id } });
    if (!file || file.removedAt || (!file.courseCode && !(await canOpenPrivateFile(file, userId)))) {
      res.status(404).json({ error: "This file is no longer available" });
      return;
    }
    // Always a download with no sniffing, so an uploaded file never runs on this site.
    res.attachment(file.name);
    res.set("Content-Type", "application/octet-stream");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Content-Security-Policy", "sandbox; default-src 'none'");
    res.send(Buffer.from(file.data));
  } catch (err) {
    console.error("File download error:", err);
    res.status(500).json({ error: "Could not download this file" });
  }
});

/** Conversation members, plus administrators reviewing a report about this exact file. */
async function canOpenPrivateFile(file: { id: string; conversationId: string; name: string; mimeType: string; size: number }, userId: string) {
  const member = await prisma.participant.findUnique({ where: { conversationId_userId: { conversationId: file.conversationId, userId } }, select: { id: true } });
  if (member) return true;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== "ADMINISTRATOR") return false;
  const fileKey = attachmentKey({ url: sharedFileUrl(file.id), name: file.name, mimeType: file.mimeType, size: file.size });
  return Boolean(await prisma.report.findFirst({ where: { targetType: "FILE", fileKey }, select: { id: true } }));
}
