import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { Prisma } from "@prisma/client";
import { thumbnailOrOriginal } from "../lib/thumbnails.js";
import { listingImageThumbnails } from "../lib/photoThumbnails.js";

export const listingsRouter = Router();

listingsRouter.use(requireAuth);

// Prisma's Int is 32-bit on MongoDB
const MAX_PRICE_CENTS = 2_147_483_647;
// Photos are resized/limited to 2 MB client-side and sent as base64 data URLs
const MAX_IMAGE_CHARS = 3 * 1024 * 1024;

const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 50;
// Full-size photos for the details and edit pages; thumbnails stay server-side
const fullImages = { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, sortOrder: true } } satisfies Prisma.Listing$imagesArgs;
const listingInclude = {
  category: true,
  images: fullImages,
  seller: { select: { id: true, profile: { select: { displayName: true, avatarUrl: true } } } },
} satisfies Prisma.ListingInclude;

// Price filters arrive in dollars (what the UI shows) and are stored in cents
const searchSchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  condition: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0, "Minimum price cannot be negative").optional(),
  maxPrice: z.coerce.number().min(0, "Maximum price cannot be negative").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  mine: z.enum(["true", "false"]).optional(),
});

const createListingSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(100),
  description: z.string().trim().min(1, "Description is required").max(2000),
  priceCents: z
    .number()
    .int()
    .min(0, "Price cannot be negative")
    .max(MAX_PRICE_CENTS, "Price is too high"),
  categoryId: z.string().min(1, "Category is required"),
  condition: z.string().trim().min(1, "Condition is required").max(50),
  images: z
    .array(
      z.object({
        url: z
          .string()
          .max(MAX_IMAGE_CHARS, "Each photo must be smaller than 2 MB")
          .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/, "Photos must be JPEG, PNG or WebP"),
      }),
    )
    .max(5, "You can upload a maximum of 5 photos"),
});

/** Image rows to create, in order, each with its grid thumbnail */
function withThumbnails(images: { url: string }[]) {
  return Promise.all(images.map(async (image, sortOrder) => ({
    url: image.url, sortOrder, thumbnailUrl: await thumbnailOrOriginal(image.url),
  })));
}

listingsRouter.get("/categories", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
    });

    res.json(categories);
  } catch (err) {
    console.error("Get categories error:", err);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

listingsRouter.get("/", async (req, res) => {
  try {
    const parsedQuery = searchSchema.safeParse(req.query);
    if (!parsedQuery.success) {
      res.status(400).json({ error: parsedQuery.error.issues[0]?.message ?? "Invalid search" });
      return;
    }
    const { search, categoryId, condition, minPrice, maxPrice, page, limit, mine } = parsedQuery.data;

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      res.status(400).json({ error: "Minimum price cannot be higher than maximum price" });
      return;
    }

    const where: Prisma.ListingWhereInput = {
      status: { in: ["ACTIVE", "SOLD"] },
      ...(mine === "true" ? { sellerId: req.user!.userId } : {}),
    };

    if (search) {
      where.OR = [
        {
          title: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (condition) {
      where.condition = condition;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.priceCents = {
        ...(minPrice !== undefined ? { gte: Math.round(minPrice * 100) } : {}),
        ...(maxPrice !== undefined ? { lte: Math.round(maxPrice * 100) } : {}),
      };
    }

    // Fetch one extra row to know whether another page exists without a count query
    const rows = await prisma.listing.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit + 1,
      include: {
        category: true,
        // The grid only shows the cover, and only as a thumbnail; a page of
        // full-size photos would be tens of megabytes
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { id: true, sortOrder: true, thumbnailUrl: true },
        },
        seller: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const pageRows = rows.slice(0, limit);
    const thumbnails = await listingImageThumbnails(pageRows.flatMap((listing) => listing.images));
    res.set("X-Has-More", rows.length > limit ? "true" : "false");
    res.json(pageRows.map((listing) => ({
      ...listing,
      images: listing.images.map(({ thumbnailUrl: _thumbnail, ...image }) => ({ ...image, url: thumbnails.get(image.id) ?? "" })),
    })));
  } catch (err) {
    console.error("Get listings error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

listingsRouter.get("/:id", async (req, res) => {
  try {
    const listing = await prisma.listing.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        category: true,
        images: fullImages,
        seller: {
          select: {
            id: true,
            profile: {
              select: {
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!listing || listing.status === "REMOVED") {
      res.status(404).json({
        error: "Listing not found",
      });
      return;
    }

    res.json(listing);
  } catch (err) {
    console.error("Get listing error:", err);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

listingsRouter.put("/:id", async (req, res) => {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid listing" });
    return;
  }
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.status === "REMOVED") { res.status(404).json({ error: "Listing not found" }); return; }
    if (existing.sellerId !== req.user!.userId) { res.status(403).json({ error: "You can only edit your own listings" }); return; }
    const { images, ...data } = parsed.data;
    if (!(await prisma.category.findUnique({ where: { id: data.categoryId } }))) {
      res.status(400).json({ error: "Category not found" }); return;
    }
    // Nested updates atomically replace photos without exposing partial edits.
    const updated = await prisma.listing.update({
      where: { id: existing.id, sellerId: req.user!.userId, status: { not: "REMOVED" } },
      data: { ...data, images: { deleteMany: {}, create: await withThumbnails(images) } },
      include: listingInclude,
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      res.status(404).json({ error: "Listing not found" }); return;
    }
    console.error("Update listing error:", err);
    res.status(500).json({ error: "Could not update the listing" });
  }
});

listingsRouter.patch("/:id/sold", async (req, res) => {
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.status === "REMOVED") { res.status(404).json({ error: "Listing not found" }); return; }
    if (existing.sellerId !== req.user!.userId) { res.status(403).json({ error: "You can only manage your own listings" }); return; }
    res.json(await prisma.listing.update({ where: { id: existing.id, sellerId: req.user!.userId, status: { not: "REMOVED" } }, data: { status: "SOLD" }, include: listingInclude }));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      res.status(404).json({ error: "Listing not found" }); return;
    }
    console.error("Mark listing sold error:", err);
    res.status(500).json({ error: "Could not mark the listing as sold" });
  }
});

listingsRouter.delete("/:id", async (req, res) => {
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing) { res.status(404).json({ error: "Listing not found" }); return; }
    if (existing.sellerId !== req.user!.userId) { res.status(403).json({ error: "You can only delete your own listings" }); return; }
    // Keep the record referenced by existing buyer/seller conversations.
    await prisma.listing.update({ where: { id: existing.id }, data: { status: "REMOVED", archivedAt: new Date() } });
    res.status(204).end();
  } catch (err) {
    console.error("Delete listing error:", err);
    res.status(500).json({ error: "Could not delete the listing" });
  }
});

listingsRouter.post("/", async (req, res) => {
  try {
    const parsed = createListingSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      });
      return;
    }

    const userId = req.user!.userId;

    const { title, description, priceCents, categoryId, condition, images } =
      parsed.data;

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      res.status(400).json({
        error: "Category not found",
      });
      return;
    }

    const listing = await prisma.listing.create({
      data: {
        sellerId: userId,
        categoryId,
        title,
        description,
        priceCents,
        condition,
        images: {
          create: await withThumbnails(images),
        },
      },
      include: {
        category: true,
        images: fullImages,
      },
    });

    res.status(201).json(listing);
  } catch (err) {
    console.error("Create listing error:", err);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});
