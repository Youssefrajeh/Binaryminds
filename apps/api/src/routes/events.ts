import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/roles.middleware.js";
import { photoSchema } from "../lib/photos.js";

export const eventsRouter = Router();
eventsRouter.use(requireAuth);
const organizerOnly = requireRoles("ORGANIZER", "ADMINISTRATOR");
const includeOrganizer = {
  organizer: {
    select: {
      id: true,
      profile: { select: { displayName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.EventInclude;
const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});
const includeAttendance = (userId: string) => ({
  ...includeOrganizer,
  rsvps: { where: { userId }, select: { id: true } },
});
function withAttendance(event: Prisma.EventGetPayload<{ include: ReturnType<typeof includeAttendance> }>) {
  const { rsvps, ...details } = event;
  return { ...details, isRsvped: Boolean(rsvps?.length) };
}
const eventSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    description: z.string().trim().min(1, "Description is required").max(2000),
    location: z.string().trim().min(1, "Location is required").max(120),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    endDate: z.iso.date().nullable().default(null),
    imageUrl: photoSchema.nullable().optional(),
  })
  .superRefine(({ startsAt, endsAt, endDate }, ctx) => {
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt))
      ctx.addIssue({
        code: "custom",
        message: "End time must be after the start time",
        path: ["endsAt"],
      });
    if (endDate && endDate < startsAt.slice(0, 10))
      ctx.addIssue({ code: "custom", message: "End date cannot be before the start date", path: ["endDate"] });
    if (endDate && endsAt && endDate !== endsAt.slice(0, 10))
      ctx.addIssue({ code: "custom", message: "End date and end time must refer to the same day", path: ["endDate"] });
  });

const FUTURE_START_ERROR = "The event must start in the future";

// New events must start in the future. Edits only need that when the start
// time moves, so an organizer can still fix the details of a running event.
const createEventSchema = eventSchema.superRefine(({ startsAt }, ctx) => {
  if (Date.parse(startsAt) <= Date.now())
    ctx.addIssue({ code: "custom", message: FUTURE_START_ERROR, path: ["startsAt"] });
});

eventsRouter.get("/", async (req, res) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid event page" });
    return;
  }
  try {
    const { page, limit } = parsed.data;
    const rows = await prisma.event.findMany({
      where: { status: "PUBLISHED", startsAt: { gt: new Date() } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      include: includeAttendance(req.user!.userId),
      skip: (page - 1) * limit,
      take: limit + 1,
    });
    res.set("X-Has-More", String(rows.length > limit));
    res.json(rows.slice(0, limit).map(withAttendance));
  } catch (err) {
    console.error("Browse events error:", err);
    res.status(500).json({ error: "Could not load events" });
  }
});

eventsRouter.get("/saved", async (req, res) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid event page" });
    return;
  }
  try {
    const { page, limit } = parsed.data;
    const rows = await prisma.event.findMany({
      where: { rsvps: { some: { userId: req.user!.userId } }, status: { in: ["PUBLISHED", "CANCELLED"] } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      include: includeOrganizer,
      skip: (page - 1) * limit,
      take: limit + 1,
    });
    res.set("X-Has-More", String(rows.length > limit));
    res.json(rows.slice(0, limit).map((event) => ({ ...event, isRsvped: true })));
  } catch (err) {
    console.error("Saved events error:", err);
    res.status(500).json({ error: "Could not load saved events" });
  }
});

eventsRouter.post("/:id/rsvp", async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, startsAt: true },
    });
    if (!event || event.status === "DRAFT") {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    if (event.status !== "PUBLISHED" || event.startsAt <= new Date()) {
      res.status(409).json({ error: "RSVP is only available for upcoming, published events" });
      return;
    }
    const userId = req.user!.userId;
    await prisma.rsvp.upsert({
      where: { eventId_userId: { eventId: event.id, userId } },
      create: { eventId: event.id, userId },
      update: {},
    });
    res.json({ isRsvped: true });
  } catch (err) {
    // Concurrent first-time submissions can both reach the unique index.
    if ((err as { code?: string }).code === "P2002") {
      res.json({ isRsvped: true });
      return;
    }
    console.error("RSVP error:", err);
    res.status(500).json({ error: "Could not RSVP to the event" });
  }
});

eventsRouter.delete("/:id/rsvp", async (req, res) => {
  try {
    await prisma.rsvp.deleteMany({ where: { eventId: req.params.id, userId: req.user!.userId } });
    res.sendStatus(204);
  } catch (err) {
    console.error("Cancel RSVP error:", err);
    res.status(500).json({ error: "Could not cancel your RSVP" });
  }
});

eventsRouter.get("/mine", organizerOnly, async (req, res) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid event page" });
    return;
  }
  try {
    const { page, limit } = parsed.data;
    const rows = await prisma.event.findMany({
      where: { organizerId: req.user!.userId },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      include: includeOrganizer,
      skip: (page - 1) * limit,
      take: limit + 1,
    });
    res.set("X-Has-More", String(rows.length > limit));
    res.json(rows.slice(0, limit));
  } catch (err) {
    console.error("Manage events error:", err);
    res.status(500).json({ error: "Could not load your events" });
  }
});

eventsRouter.get("/:id", async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: includeOrganizer,
    });
    if (
      !event ||
      (event.status !== "PUBLISHED" && event.organizerId !== req.user!.userId)
    ) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json(event);
  } catch (err) {
    console.error("Get event error:", err);
    res.status(500).json({ error: "Could not load the event" });
  }
});

eventsRouter.post("/", organizerOnly, async (req, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        error: parsed.error.issues[0]?.message ?? "Invalid event",
        details: parsed.error.flatten().fieldErrors,
      });
    return;
  }
  try {
    const event = await prisma.event.create({
      data: {
        ...parsed.data,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        organizerId: req.user!.userId,
        status: "PUBLISHED",
      },
      include: includeOrganizer,
    });
    res.status(201).json(event);
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: "Could not create the event" });
  }
});

eventsRouter.put("/:id", organizerOnly, async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: parsed.error.issues[0]?.message ?? "Invalid event" });
    return;
  }
  try {
    const existing = await prisma.event.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    if (existing.organizerId !== req.user!.userId) {
      res.status(403).json({ error: "Only the event's organizer can edit it" });
      return;
    }
    const startsAt = Date.parse(parsed.data.startsAt);
    if (startsAt !== existing.startsAt.getTime() && startsAt <= Date.now()) {
      res.status(400).json({ error: FUTURE_START_ERROR });
      return;
    }
    const changed = await prisma.event.updateMany({
      where: {
        id: existing.id,
        organizerId: req.user!.userId,
        status: { not: "CANCELLED" },
      },
      data: {
        ...parsed.data,
        startsAt: new Date(parsed.data.startsAt),
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      },
    });
    if (!changed.count) {
      res.status(409).json({ error: "Cancelled events cannot be edited" });
      return;
    }
    res.json(
      await prisma.event.findUniqueOrThrow({
        where: { id: existing.id },
        include: includeOrganizer,
      }),
    );
  } catch (err) {
    console.error("Update event error:", err);
    res.status(500).json({ error: "Could not update the event" });
  }
});

eventsRouter.patch("/:id/cancel", organizerOnly, async (req, res) => {
  try {
    const existing = await prisma.event.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    if (existing.organizerId !== req.user!.userId) {
      res
        .status(403)
        .json({ error: "Only the event's organizer can cancel it" });
      return;
    }
    res.json(
      await prisma.event.update({
        where: { id: existing.id },
        data: { status: "CANCELLED" },
        include: includeOrganizer,
      }),
    );
  } catch (err) {
    console.error("Cancel event error:", err);
    res.status(500).json({ error: "Could not cancel the event" });
  }
});
