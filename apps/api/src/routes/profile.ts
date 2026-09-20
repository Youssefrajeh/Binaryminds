import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const profileRouter = Router();

const updateProfileSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(50),
  program: z.string().max(100).nullable().optional(),
  yearOfStudy: z.number().int().min(1).max(8).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  interests: z.array(z.string().max(30)).max(10).optional(),
});

/* ------------------------------------------------------------------ */
/*  GET /profile/me                                                    */
/* ------------------------------------------------------------------ */

profileRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { profile: true },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      profile: user.profile ?? null,
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  PUT /profile/me                                                    */
/* ------------------------------------------------------------------ */

profileRouter.put("/me", requireAuth, async (req, res) => {
  try {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const data = parsed.data;
    const userId = req.user!.userId;

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: {
        userId,
        displayName: data.displayName,
        program: data.program ?? null,
        yearOfStudy: data.yearOfStudy ?? null,
        bio: data.bio ?? null,
        interests: data.interests ?? [],
      },
      update: {
        displayName: data.displayName,
        program: data.program ?? null,
        yearOfStudy: data.yearOfStudy ?? null,
        bio: data.bio ?? null,
        interests: data.interests ?? [],
      },
    });

    res.json(profile);
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
