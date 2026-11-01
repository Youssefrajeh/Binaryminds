import { Router } from "express";
import { z } from "zod";
import type {
  PublicProfileDto,
  StudentSearchResultDto,
} from "@campushub/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const profileRouter = Router();

const courseCode = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9 -]*$/,
    "Use letters, numbers, spaces or hyphens in course codes",
  )
  .transform((value) => value.replace(/[ -]/g, "").toUpperCase());
const interestTag = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .transform((value) => value.toLowerCase());
const uniqueTags = (values: string[]) => [...new Set(values)];
const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(50),
  program: z.string().trim().max(100).nullable().optional(),
  yearOfStudy: z.number().int().min(1).max(8).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  interests: z.array(interestTag).max(10).transform(uniqueTags).optional(),
  courses: z.array(courseCode).max(20).transform(uniqueTags).optional(),
});

// The web client crops and resizes photos to a small square JPEG before upload,
// so they are stored inline on the profile (Render's disk is not persistent).
const MAX_AVATAR_BYTES = 300 * 1024;

const avatarSchema = z.object({
  image: z
    .string()
    .regex(
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/,
      "Image must be a JPEG, PNG or WebP",
    )
    .refine(
      (value) =>
        Buffer.byteLength(value.slice(value.indexOf(",") + 1), "base64") <=
        MAX_AVATAR_BYTES,
      "Image is too large (max 300 KB)",
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
        error: parsed.error.issues[0]?.message ?? "Validation failed",
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
        courses: data.courses ?? [],
      },
      update: {
        displayName: data.displayName,
        program: data.program ?? null,
        yearOfStudy: data.yearOfStudy ?? null,
        bio: data.bio ?? null,
        interests: data.interests ?? [],
        ...(data.courses !== undefined ? { courses: data.courses } : {}),
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
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message ?? "Invalid image" });
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
      create: {
        userId,
        displayName: defaultDisplayName(user.email),
        avatarUrl: parsed.data.image,
        interests: [],
      },
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
/*  GET /profile/search — name, program, course and interest filters    */
/*  Must be registered before /:userId or it would be shadowed.         */
/* ------------------------------------------------------------------ */

const MAX_SEARCH_RESULTS = 20;
const searchSchema = z.object({
  q: z.string().trim().max(100).default(""),
  program: z.string().trim().max(100).default(""),
  course: z.union([z.literal(""), courseCode]).default(""),
  interest: z
    .string()
    .trim()
    .max(30)
    .transform((value) => value.toLowerCase())
    .default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

profileRouter.get("/search", requireAuth, async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid student search filters" });
    return;
  }
  try {
    const { q, program, course, interest, page } = parsed.data;
    if (
      (q.length > 0 && q.length < 2) ||
      !(q || program || course || interest)
    ) {
      res.set("X-Has-More", "false");
      res.json([]);
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        id: { not: req.user!.userId },
        ...(q
          ? {
              OR: [
                {
                  profile: {
                    is: { displayName: { contains: q, mode: "insensitive" } },
                  },
                },
                // Students without a profile are shown by the part of their email before the @
                { email: { startsWith: q, mode: "insensitive" } },
              ],
            }
          : {}),
        ...(program || course || interest
          ? {
              profile: {
                is: {
                  ...(program
                    ? {
                        program: {
                          contains: program,
                          mode: "insensitive" as const,
                        },
                      }
                    : {}),
                  ...(course ? { courses: { has: course } } : {}),
                  ...(interest ? { interests: { has: interest } } : {}),
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true,
            program: true,
            courses: true,
            interests: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * MAX_SEARCH_RESULTS,
      take: MAX_SEARCH_RESULTS + 1,
    });

    const results: StudentSearchResultDto[] = users
      .slice(0, MAX_SEARCH_RESULTS)
      .map((user) => ({
        id: user.id,
        displayName:
          user.profile?.displayName || defaultDisplayName(user.email),
        avatarUrl: user.profile?.avatarUrl ?? null,
        program: user.profile?.program ?? null,
        courses: user.profile?.courses ?? [],
        interests: user.profile?.interests ?? [],
      }));

    res.set("X-Has-More", String(users.length > MAX_SEARCH_RESULTS));
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
      courses: user.profile?.courses ?? [],
      createdAt: user.createdAt.toISOString(),
    };

    res.json(profile);
  } catch (err) {
    console.error("Get public profile error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
