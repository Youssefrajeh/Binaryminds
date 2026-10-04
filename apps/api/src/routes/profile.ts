import { Router } from "express";
import { z } from "zod";
import type { PublicProfileDto } from "@campushub/shared";
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

// The web client crops and resizes photos to a small square JPEG before upload,
// so they are stored inline on the profile (Render's disk is not persistent).
const MAX_AVATAR_BYTES = 300 * 1024;

const avatarSchema = z.object({
  image: z
    .string()
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, "Image must be a JPEG, PNG or WebP")
    .refine(
      (value) => Buffer.byteLength(value.slice(value.indexOf(",") + 1), "base64") <= MAX_AVATAR_BYTES,
      "Image is too large (max 300 KB)"
    ),
});

function defaultDisplayName(email: string) {
  return email.split("@")[0];
}

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

/* ------------------------------------------------------------------ */
/*  PUT /profile/me/avatar                                             */
/* ------------------------------------------------------------------ */

profileRouter.put("/me/avatar", requireAuth, async (req, res) => {
  try {
    const parsed = avatarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid image" });
      return;
    }

    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const profile = await prisma.profile.upsert({
      where: { userId },
      create: { userId, displayName: defaultDisplayName(user.email), avatarUrl: parsed.data.image, interests: [] },
      update: { avatarUrl: parsed.data.image },
    });

    res.json(profile);
  } catch (err) {
    console.error("Update avatar error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  DELETE /profile/me/avatar                                          */
/* ------------------------------------------------------------------ */

profileRouter.delete("/me/avatar", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const existing = await prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const profile = await prisma.profile.update({
      where: { userId },
      data: { avatarUrl: null },
    });

    res.json(profile);
  } catch (err) {
    console.error("Delete avatar error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /profile/search?q= — find students by name                      */
/*  Must be registered before /:userId or it would be shadowed.         */
/* ------------------------------------------------------------------ */

const MAX_SEARCH_RESULTS = 20;

profileRouter.get("/search", requireAuth, async (req, res) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        id: { not: req.user!.userId },
        OR: [
          { profile: { is: { displayName: { contains: q, mode: "insensitive" } } } },
          // Students without a profile are shown by the part of their email before the @
          { email: { startsWith: q, mode: "insensitive" } },
        ],
      },
      include: { profile: true },
      orderBy: { createdAt: "desc" },
      take: MAX_SEARCH_RESULTS,
    });

    const results = users.map((user) => ({
      id: user.id,
      displayName: user.profile?.displayName || defaultDisplayName(user.email),
      avatarUrl: user.profile?.avatarUrl ?? null,
      program: user.profile?.program ?? null,
    }));

    res.json(results);
  } catch (err) {
    console.error("Search members error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  GET /profile/:userId — public view of another student              */
/* ------------------------------------------------------------------ */

profileRouter.get("/:userId", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.userId },
      include: { profile: true },
    });

    if (!user || user.status !== "ACTIVE") {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const profile: PublicProfileDto = {
      id: user.id,
      displayName: user.profile?.displayName || defaultDisplayName(user.email),
      avatarUrl: user.profile?.avatarUrl ?? null,
      program: user.profile?.program ?? null,
      yearOfStudy: user.profile?.yearOfStudy ?? null,
      bio: user.profile?.bio ?? null,
      interests: user.profile?.interests ?? [],
      createdAt: user.createdAt.toISOString(),
    };

    res.json(profile);
  } catch (err) {
    console.error("Get public profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
