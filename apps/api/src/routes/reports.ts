import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { REPORT_REASONS, type AdminReportDto, type ReportSnapshot } from "@campushub/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { reportContent, removeReportedContent, ReportError } from "../lib/reportContent.js";
import { toMessageDto } from "../lib/conversations.js";
import { emitToAll, emitToUsers } from "../socket/io.js";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);
// Mounted inside adminRouter, after its current-administrator authorization.
export const adminReportsRouter = Router();
const targetType = z.enum(["LISTING", "LOST_FOUND_POST", "MESSAGE", "FILE"]);
const createSchema = z.object({
  targetType, targetId: z.string().trim().min(1).max(100),
  reason: z.enum(REPORT_REASONS.map((reason) => reason.value)),
  note: z.string().trim().max(1000).optional(),
  attachmentIndex: z.number().int().min(0).max(49).optional(),
}).refine((value) => value.targetType === "FILE" ? value.attachmentIndex !== undefined : value.attachmentIndex === undefined, "Choose a valid report target");

function failure(res: import("express").Response, err: unknown, context: string) {
  if (err instanceof ReportError) { res.status(err.status).json({ error: err.message }); return; }
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
    res.status(409).json({ error: "Another administrator changed this content. Refresh and try again." }); return;
  }
  console.error(context, err);
  res.status(500).json({ error: "Could not complete the report request. Please try again." });
}

reportsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message || "Choose a reason and valid content" }); return; }
  try {
    const { targetType, targetId, reason, note, attachmentIndex } = parsed.data;
    const content = await reportContent(prisma, req.user!.userId, targetType, targetId, attachmentIndex);
    const existing = await prisma.report.findFirst({ where: { reporterId: req.user!.userId, targetType, targetId, fileKey: content.fileKey, status: "OPEN" }, select: { id: true, status: true } });
    if (existing) { res.json({ ...existing, alreadyReported: true }); return; }
    const report = await prisma.report.create({ data: { reporterId: req.user!.userId, targetType, targetId, reason, note: note || null, snapshot: content.snapshot, fileKey: content.fileKey }, select: { id: true, status: true } });
    res.status(201).json(report);
  } catch (err) { failure(res, err, "Create report error:"); }
});

const pageSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED", "DISMISSED", "ALL"]).default("OPEN"),
  type: targetType.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

adminReportsRouter.get("/", async (req, res) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "Invalid report filters" }); return; }
  try {
    const { status, type, page, limit } = parsed.data;
    const rows = await prisma.report.findMany({
      where: { ...(status === "ALL" ? {} : { status: status === "RESOLVED" ? { in: ["RESOLVED", "ACTIONED"] } : status }), ...(type ? { targetType: type } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit + 1,
      include: { moderationActions: { orderBy: { createdAt: "desc" }, take: 5, select: { action: true, note: true, createdAt: true } } },
    });
    const pageRows = rows.slice(0, limit);
    const reporters = await prisma.user.findMany({ where: { id: { in: [...new Set(pageRows.map((row) => row.reporterId))] } }, select: { id: true, email: true, profile: { select: { displayName: true } } } });
    const people = new Map(reporters.map((person) => [person.id, person]));
    const result: AdminReportDto[] = pageRows.map((row) => {
      const reporter = people.get(row.reporterId);
      const snapshot = row.snapshot && typeof row.snapshot === "object" && !Array.isArray(row.snapshot) && typeof row.snapshot.title === "string" && typeof row.snapshot.text === "string" ? row.snapshot as ReportSnapshot : null;
      return { id: row.id, targetType: row.targetType, targetId: row.targetId, reason: row.reason, note: row.note, status: row.status === "ACTIONED" ? "RESOLVED" : row.status, createdAt: row.createdAt.toISOString(), reporter: { name: reporter?.profile?.displayName || reporter?.email || "Deleted account", email: reporter?.email || null }, snapshot, actions: row.moderationActions.map((action) => ({ ...action, createdAt: action.createdAt.toISOString() })) };
    });
    res.set("X-Has-More", String(rows.length > limit)); res.json(result);
  } catch (err) { failure(res, err, "Load reports error:"); }
});

adminReportsRouter.post("/:id/actions", async (req, res) => {
  const parsed = z.object({ action: z.enum(["REMOVE_CONTENT", "RESOLVE", "DISMISS"]), note: z.string().trim().max(1000).optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose a valid moderation action" }); return; }
  try {
    const result = await prisma.$transaction(async (db) => {
      const report = await db.report.findUnique({ where: { id: req.params.id } });
      if (!report) throw new ReportError("Report not found");
      const status = parsed.data.action === "DISMISS" ? "DISMISSED" as const : "RESOLVED" as const;
      const claimed = await db.report.updateMany({ where: { id: report.id, status: "OPEN" }, data: { status, resolvedAt: new Date() } });
      if (!claimed.count) throw new ReportError("This report has already been reviewed. Refresh the list.", 409);
      const message = parsed.data.action === "REMOVE_CONTENT" ? await removeReportedContent(db, report) : null;
      await db.moderationAction.create({ data: { reportId: report.id, adminId: req.user!.userId, action: parsed.data.action, note: parsed.data.note || null } });
      const members = message ? await db.participant.findMany({ where: { conversationId: message.conversationId }, select: { userId: true } }) : [];
      const publicTarget = parsed.data.action === "REMOVE_CONTENT" && (report.targetType === "LISTING" || report.targetType === "LOST_FOUND_POST") ? { targetType: report.targetType, targetId: report.targetId } : null;
      return { id: report.id, status, message, memberIds: members.map((member) => member.userId), publicTarget };
    });
    if (result.message) {
      emitToUsers(result.memberIds, "message:updated", { message: toMessageDto(result.message) });
    }
    if (result.publicTarget) emitToAll("content:removed", result.publicTarget);
    res.json({ id: result.id, status: result.status });
  } catch (err) { failure(res, err, "Review report error:"); }
});
