import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { Prisma } from "@prisma/client";

export const listingsRouter = Router();

listingsRouter.use(requireAuth);

// Prisma's Int is 32-bit on MongoDB
const MAX_PRICE_CENTS = 2_147_483_647;
// Photos are resized/limited to 2 MB client-side and sent as base64 data URLs
const MAX_IMAGE_CHARS = 3 * 1024 * 1024;

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
    const search = String(req.query.search ?? "").trim();
    const categoryId = String(req.query.categoryId ?? "").trim();
    const condition = String(req.query.condition ?? "").trim();

    const where: Prisma.ListingWhereInput = {
      status: "ACTIVE",
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

    const listings = await prisma.listing.findMany({
      where,
      include: {
        category: true,
        // The grid only shows the cover photo; the details page loads the rest
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
        },
        seller: {
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(listings);
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
        images: {
          orderBy: {
            sortOrder: "asc",
          },
        },
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

    if (!listing || listing.status !== "ACTIVE") {
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
          create: images.map((image, index) => ({
            url: image.url,
            sortOrder: index,
          })),
        },
      },
      include: {
        category: true,
        images: {
          orderBy: {
            sortOrder: "asc",
          },
        },
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
