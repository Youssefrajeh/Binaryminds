import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/roles.middleware.js";
import { disconnectUser, emitToUsers } from "../socket/io.js";
import { adminReportsRouter } from "./reports.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRoles("ADMINISTRATOR"));
adminRouter.use("/reports", adminReportsRouter);

const userSelect = {
  id: true, email: true, role: true, status: true, emailVerifiedAt: true, createdAt: true, suspendedAt: true, suspendedReason: true,
  profile: { select: { displayName: true, avatarUrl: true } },
} satisfies Prisma.UserSelect;

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: z.enum(["STUDENT", "ORGANIZER", "ADMINISTRATOR"]).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

adminRouter.get("/users", async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid user search" });
    return;
  }
  const { search, role, page, limit } = parsed.data;
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(search ? { OR: [
      { email: { contains: search, mode: "insensitive" } },
      { profile: { is: { displayName: { contains: search, mode: "insensitive" } } } },
    ] } : {}),
  };
  try {
    const users = await prisma.user.findMany({
      where, select: userSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit, take: limit + 1,
    });
    res.set("X-Has-More", String(users.length > limit));
    res.json(users.slice(0, limit));
  } catch (err) {
    console.error("Admin user search error:", err);
    res.status(500).json({ error: "Could not load users" });
  }
});

adminRouter.patch("/users/:id/role", async (req, res) => {
  const parsed = z.object({ role: z.enum(["STUDENT", "ORGANIZER", "ADMINISTRATOR"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose Student, Organizer, or Administrator" });
    return;
  }
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: userSelect });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    // Keep existing administrators protected, including the caller's own account.
    if (target.role === "ADMINISTRATOR" || target.id === req.user!.userId) {
      res.status(403).json({ error: "Administrator accounts cannot be changed here" });
      return;
    }
    if (parsed.data.role !== "STUDENT" && (target.status !== "ACTIVE" || !target.emailVerifiedAt)) {
      res.status(409).json({ error: "Only active, verified members can become organizers or administrators" });
      return;
    }
    // Guard against a concurrent promotion to administrator before this update.
    const result = await prisma.user.updateMany({
      where: { id: target.id, role: target.role, status: target.status }, data: { role: parsed.data.role },
    });
    if (!result.count) {
      res.status(409).json({ error: "This account changed. Refresh the users list and try again." });
      return;
    }
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: userSelect });
    emitToUsers([target.id], "user:role-changed", { role: updated.role });
    res.json(updated);
  } catch (err) {
    console.error("Admin role update error:", err);
    res.status(500).json({ error: "Could not update the role" });
  }
});

adminRouter.patch("/users/:id/status", async (req, res) => {
  const parsed = z.object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    reason: z.string().trim().max(500, "Keep the reason under 500 characters").optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.find((issue) => issue.path[0] === "reason")?.message ?? "Choose to suspend or reactivate the account" });
    return;
  }
  const { status } = parsed.data;
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: userSelect });
    if (!target) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (target.role === "ADMINISTRATOR" || target.id === req.user!.userId) {
      res.status(403).json({ error: "Administrator accounts cannot be changed here" });
      return;
    }
    // Pending accounts have not verified their email, so reactivating must not activate them.
    const from = status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";
    if (target.status !== from) {
      res.status(409).json({ error: status === "SUSPENDED" ? "Only active accounts can be suspended" : "Only suspended accounts can be reactivated" });
      return;
    }
    const result = await prisma.user.updateMany({
      where: { id: target.id, role: target.role, status: from },
      data: status === "SUSPENDED"
        ? { status, suspendedAt: new Date(), suspendedReason: parsed.data.reason || null, suspendedById: req.user!.userId }
        : { status, suspendedAt: null, suspendedReason: null, suspendedById: null },
    });
    if (!result.count) {
      res.status(409).json({ error: "This account changed. Refresh the users list and try again." });
      return;
    }
    if (status === "SUSPENDED") disconnectUser(target.id);
    res.json(await prisma.user.findUniqueOrThrow({ where: { id: target.id }, select: userSelect }));
  } catch (err) {
    console.error("Admin status update error:", err);
    res.status(500).json({ error: "Could not update the account" });
  }
});
