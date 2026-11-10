import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import {
  campusToday,
  LOST_FOUND_CATEGORIES,
} from "@campushub/shared";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { photoSchema } from "../lib/photos.js";
import { thumbnailToStore } from "../lib/thumbnails.js";
import { lostFoundThumbnails } from "../lib/photoThumbnails.js";

export const lostFoundRouter = Router();
lostFoundRouter.use(requireAuth);

const categorySchema = z.enum(
  LOST_FOUND_CATEGORIES.map((category) => category.value),
);
const calendarDate = z.iso.date("Use a valid date in YYYY-MM-DD format");

const createSchema = z.object({
  kind: z.enum(["LOST", "FOUND"]),
  title: z.string().trim().min(1, "Title is required").max(100),
  description: z.string().trim().min(1, "Description is required").max(2000),
  category: categorySchema,
  location: z.string().trim().min(1, "Location is required").max(120),
  occurredOn: calendarDate.refine(
    (date) => date <= campusToday(),
    "Date cannot be in the future",
  ),
  imageUrl: photoSchema.nullable().default(null),
});

const searchSchema = z
  .object({
    search: z.string().trim().max(100).optional(),
    kind: z.enum(["LOST", "FOUND"]).optional(),
    category: categorySchema.optional(),
    location: z.string().trim().max(120).optional(),
    from: calendarDate.optional(),
    to: calendarDate.optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: "The start date must be on or before the end date",
    path: ["from"],
  });

// Only public profile fields are returned, never account emails or password hashes.
const authorInclude = {
  author: {
    select: {
      id: true,
      profile: { select: { displayName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.LostFoundPostInclude;

// The board shows photos small, so posts are read with their thumbnail and
// never with the full photo
const postCardSelect = {
  id: true, authorId: true, kind: true, title: true, description: true, category: true,
  location: true, occurredOn: true, status: true, createdAt: true, removedAt: true,
  thumbnailUrl: true,
  ...authorInclude,
} satisfies Prisma.LostFoundPostSelect;

type PostCardRow = Prisma.LostFoundPostGetPayload<{ select: typeof postCardSelect }>;

/** Posts as the board shows them, with the thumbnail under the usual imageUrl name */
async function toPosts(rows: PostCardRow[]) {
  const thumbnails = await lostFoundThumbnails(rows);
  return rows.map(({ thumbnailUrl: _thumbnail, ...post }) => ({
    ...post,
    category: post.category ?? "OTHER",
    imageUrl: thumbnails.get(post.id) ?? null,
  }));
}

lostFoundRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        error: parsed.error.issues[0]?.message ?? "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    return;
  }
  try {
    const post = await prisma.lostFoundPost.create({
      data: {
        ...parsed.data,
        authorId: req.user!.userId,
        occurredOn: new Date(`${parsed.data.occurredOn}T00:00:00.000Z`),
        thumbnailUrl: await thumbnailToStore(parsed.data.imageUrl),
        status: "OPEN",
      },
      select: postCardSelect,
    });
    const [created] = await toPosts([post]);
    res.status(201).json(created);
  } catch (err) {
    console.error("Create lost & found post error:", err);
    res
      .status(500)
      .json({ error: "Could not create the post. Please try again." });
  }
});

lostFoundRouter.get("/", async (req, res) => {
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Invalid filters" });
    return;
  }
  const { search, kind, category, location, from, to, page, limit } =
    parsed.data;
  const visible = { OR: [{ removedAt: null }, { removedAt: { isSet: false } }] };
  const where: Prisma.LostFoundPostWhereInput = { AND: [visible] };
  if (kind) where.kind = kind;
  // Older MongoDB documents predate the category field and belong under Other.
  if (category === "OTHER")
    where.OR = [
      { category: "OTHER" },
      { category: null },
      { category: { isSet: false } },
    ];
  else if (category) where.category = category;
  if (location) where.location = { contains: location, mode: "insensitive" };
  if (search) {
    where.AND = [
      visible,
      {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      },
    ];
  }
  if (from || to) {
    where.occurredOn = {
      ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to
        ? {
            lt: new Date(
              new Date(`${to}T00:00:00.000Z`).getTime() + 86_400_000,
            ),
          }
        : {}),
    };
  }
  try {
    const rows = await prisma.lostFoundPost.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit + 1,
      select: postCardSelect,
    });
    res.set("X-Has-More", String(rows.length > limit));
    res.json(await toPosts(rows.slice(0, limit)));
  } catch (err) {
    console.error("List lost & found posts error:", err);
    res.status(500).json({ error: "Could not load posts. Please try again." });
  }
});

// The existing board already offers this owner action; keep it functional.
lostFoundRouter.patch("/:id/resolve", async (req, res) => {
  try {
    const existing = await prisma.lostFoundPost.findUnique({
      where: { id: req.params.id },
    });
    if (!existing || existing.removedAt) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    if (existing.authorId !== req.user!.userId) {
      res.status(403).json({ error: "You can only resolve your own posts" });
      return;
    }
    const post = await prisma.lostFoundPost.update({
      where: { id: existing.id },
      data: { status: "RESOLVED" },
      select: postCardSelect,
    });
    const [resolved] = await toPosts([post]);
    res.json(resolved);
  } catch (err) {
    console.error("Resolve lost & found post error:", err);
    res
      .status(500)
      .json({ error: "Could not resolve the post. Please try again." });
  }
});
