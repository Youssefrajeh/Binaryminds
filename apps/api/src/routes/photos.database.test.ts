import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import sharp from "sharp";
import { signToken } from "../lib/jwt.js";

/*
 * Lists send small thumbnails and detail pages send the full photo, against a
 * real MongoDB so the Prisma selects that keep full photos out are exercised.
 */

let database: MongoMemoryReplSet | undefined;
let prisma: PrismaClient;
let app: ReturnType<typeof import("../app.js").createApp>;
const student = `Bearer ${signToken({ userId: "student", role: "STUDENT" })}`;
const organizer = `Bearer ${signToken({ userId: "organizer", role: "ORGANIZER" })}`;
let photo = "";

/** A 1600x1200 photo-like JPEG of a few hundred KB */
async function makePhoto() {
  const width = 1600, height = 1200;
  const pixels = Buffer.alloc(width * height * 3);
  let state = 2463534242;
  for (let i = 0; i < pixels.length; i++) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    // A gradient plus noise compresses like a real photo
    pixels[i] = ((i % (width * 3)) / 12 + ((state >>> 0) & 63)) & 255;
  }
  const jpeg = await sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

const isThumbnail = (url: string) => url.startsWith("data:image/webp;base64,") && url.length < photo.length / 3;

beforeAll(async () => {
  photo = await makePhoto();
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const url = database.getUri("campushub_photos_test");
  const require = createRequire(import.meta.url);
  await promisify(execFile)(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push", "--schema", fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)), "--skip-generate"], { env: { ...process.env, DATABASE_URL: url }, timeout: 60000 });
  prisma = new PrismaClient({ datasourceUrl: url });
  vi.doMock("../lib/prisma.js", () => ({ prisma }));
  const { createApp } = await import("../app.js");
  app = createApp();
  for (const [id, role] of [["student", "STUDENT"], ["organizer", "ORGANIZER"]] as const) {
    await prisma.user.create({ data: { id, email: `${id}@fanshaweonline.ca`, passwordHash: "x", status: "ACTIVE", emailVerifiedAt: new Date(), role, profile: { create: { displayName: id, interests: [] } } } });
  }
  await prisma.category.create({ data: { id: "books", name: "Books", slug: "books" } });
}, 180000);

beforeEach(async () => {
  await prisma.message.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.listingImage.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.event.deleteMany();
  await prisma.lostFoundPost.deleteMany();
});

afterAll(async () => {
  await prisma?.$disconnect();
  await database?.stop();
  vi.doUnmock("../lib/prisma.js");
}, 30000);

describe("marketplace photos", () => {
  const listing = () => ({ title: "Calculus textbook", description: "Like new", priceCents: 4500, categoryId: "books", condition: "LIKE_NEW", images: [{ url: photo }, { url: photo }] });

  it("sends the grid a thumbnail and the details page every full photo", async () => {
    const created = await request(app).post("/api/listings").set("Authorization", student).send(listing());
    expect(created.status).toBe(201);
    expect(created.body.images[0].url).toBe(photo);

    const grid = await request(app).get("/api/listings").set("Authorization", student);
    expect(grid.status).toBe(200);
    expect(grid.body[0].images).toHaveLength(1);
    expect(isThumbnail(grid.body[0].images[0].url)).toBe(true);
    expect(grid.text).not.toContain(photo.slice(0, 2000));

    const details = await request(app).get(`/api/listings/${created.body.id}`).set("Authorization", student);
    expect(details.body.images.map((image: { url: string }) => image.url)).toEqual([photo, photo]);
    expect(details.body.images[0]).not.toHaveProperty("thumbnailUrl");
  });

  it("makes and saves a thumbnail for a photo saved before thumbnails existed", async () => {
    const old = await prisma.listing.create({
      data: { sellerId: "student", categoryId: "books", title: "Old", description: "Old", priceCents: 100, condition: "GOOD", images: { create: [{ url: photo, sortOrder: 0 }] } },
      include: { images: true },
    });
    expect(old.images[0].thumbnailUrl).toBeNull();

    const grid = await request(app).get("/api/listings").set("Authorization", student);

    expect(isThumbnail(grid.body[0].images[0].url)).toBe(true);
    const stored = await prisma.listingImage.findUniqueOrThrow({ where: { id: old.images[0].id } });
    expect(stored.thumbnailUrl).toBe(grid.body[0].images[0].url);
  });
});

describe("event photos", () => {
  const event = () => ({ title: "Hack night", description: "Bring a laptop", location: "SC1001", startsAt: new Date(Date.now() + 86_400_000).toISOString(), imageUrl: photo });

  it("lists events with thumbnails, opens one with the full photo, and drops both when the photo is removed", async () => {
    const created = await request(app).post("/api/events").set("Authorization", organizer).send(event());
    expect(created.status).toBe(201);
    expect(created.body.imageUrl).toBe(photo);
    expect(created.body).not.toHaveProperty("thumbnailUrl");

    for (const path of ["/api/events", "/api/events/mine"]) {
      const list = await request(app).get(path).set("Authorization", organizer);
      expect(isThumbnail(list.body[0].imageUrl)).toBe(true);
      expect(list.body[0]).not.toHaveProperty("thumbnailUrl");
    }

    const one = await request(app).get(`/api/events/${created.body.id}`).set("Authorization", organizer);
    expect(one.body.imageUrl).toBe(photo);

    const edited = await request(app).put(`/api/events/${created.body.id}`).set("Authorization", organizer).send({ ...event(), imageUrl: null });
    expect(edited.status).toBe(200);
    const stored = await prisma.event.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(stored.imageUrl).toBeNull();
    expect(stored.thumbnailUrl).toBeNull();
  });

  it("shows the event's thumbnail, not the full photo, on the chat card", async () => {
    const created = await request(app).post("/api/events").set("Authorization", organizer).send(event());

    const chat = await request(app).post("/api/conversations").set("Authorization", student).send({ recipientId: "organizer", eventId: created.body.id });

    expect(chat.status).toBe(201);
    expect(isThumbnail(chat.body.event.imageUrl)).toBe(true);
    expect(chat.body.event).not.toHaveProperty("thumbnailUrl");
  });
});

describe("lost & found photos", () => {
  it("shows the board a thumbnail and keeps posts without a photo photo-free", async () => {
    const base = { kind: "LOST", title: "Blue backpack", description: "Left after class", category: "BAGS", location: "Library", occurredOn: "2026-11-01" };
    const withPhoto = await request(app).post("/api/lost-found").set("Authorization", student).send({ ...base, imageUrl: photo });
    expect(withPhoto.status).toBe(201);
    await request(app).post("/api/lost-found").set("Authorization", student).send({ ...base, title: "Keys", imageUrl: null });

    const board = await request(app).get("/api/lost-found").set("Authorization", student);

    const byTitle = Object.fromEntries(board.body.map((post: { title: string; imageUrl: string | null }) => [post.title, post.imageUrl]));
    expect(isThumbnail(byTitle["Blue backpack"])).toBe(true);
    expect(byTitle.Keys).toBeNull();
    expect(board.text).not.toContain(photo.slice(0, 2000));
  });
});
