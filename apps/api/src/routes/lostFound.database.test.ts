import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { signToken } from "../lib/jwt.js";

let app: ReturnType<typeof import("../app.js").createApp>;
let prisma: PrismaClient;
let database: MongoMemoryReplSet | undefined;
const auth = `Bearer ${signToken({ userId: "student", role: "STUDENT" })}`;
const image = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4WQAAAAASUVORK5CYII=";
const body = {
  kind: "LOST", title: "Blue backpack", description: "A silver zipper",
  category: "BAGS", location: "Library, second floor", occurredOn: "2020-10-01", imageUrl: image,
} as const;

beforeAll(async () => {
  // Only this disposable localhost database is used, never a developer/Atlas DB.
  database = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const databaseUrl = database.getUri("campushub_lost_found_test");
  const require = createRequire(import.meta.url);
  await promisify(execFile)(process.execPath, [require.resolve("prisma/build/index.js"), "db", "push",
    "--schema", fileURLToPath(new URL("../../prisma/schema.prisma", import.meta.url)), "--skip-generate"],
  { env: { ...process.env, DATABASE_URL: databaseUrl }, timeout: 60000 });
  prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  // Inject a real client connected only to the disposable database.
  vi.doMock("../lib/prisma.js", () => ({ prisma }));
  const { createApp } = await import("../app.js");
  app = createApp();
  await prisma.user.create({ data: {
    id: "student", email: "lost-found-test@fanshaweonline.ca", passwordHash: "unused-in-this-test",
    status: "ACTIVE", emailVerifiedAt: new Date(),
  } });
}, 180000);

beforeEach(async () => {
  await prisma.lostFoundPost.deleteMany();
});

afterAll(async () => {
  await prisma?.$disconnect();
  await database?.stop();
  vi.doUnmock("../lib/prisma.js");
}, 30000);

describe("Lost & Found against real MongoDB", () => {
  it("creates both types, persists the photo, and reloads them through the mounted API", async () => {
    for (const kind of ["LOST", "FOUND"]) {
      const created = await request(app).post("/api/lost-found").set("Authorization", auth).send({ ...body, kind });
      expect(created.status).toBe(201);
      const stored = await prisma.lostFoundPost.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(stored).toMatchObject({ authorId: "student", category: "BAGS", imageUrl: image, status: "OPEN" });
      expect(stored.occurredOn.toISOString()).toBe("2020-10-01T00:00:00.000Z");
    }
    const reloaded = await request(app).get("/api/lost-found").set("Authorization", auth);
    expect(reloaded.status).toBe(200);
    expect(reloaded.body).toHaveLength(2);
    expect(reloaded.body[0].author).toEqual({ id: "student", profile: null });
    expect(JSON.stringify(reloaded.body)).not.toContain("passwordHash");
    expect(JSON.stringify(reloaded.body)).not.toContain("@fanshaweonline.ca");
  });

  it("filters actual documents by category, partial location, dates and all filters together", async () => {
    for (const kind of ["LOST", "FOUND"]) {
      const created = await request(app).post("/api/lost-found").set("Authorization", auth).send({ ...body, kind });
      expect(created.status).toBe(201);
    }
    await request(app).post("/api/lost-found").set("Authorization", auth).send({
      ...body, title: "Found keys", kind: "FOUND", category: "KEYS", location: "Gym", occurredOn: "2020-10-02", imageUrl: null,
    });
    for (const [query, count] of [
      [{ category: "KEYS" }, 1], [{ location: "LIBRARY" }, 2],
      [{ from: "2020-10-01", to: "2020-10-01" }, 2],
      [{ from: "2020-10-02" }, 1], [{ to: "2020-09-30" }, 0],
      [{ category: "BAGS", location: "library", from: "2020-10-01", to: "2020-10-01", search: "SILVER", kind: "LOST" }, 1],
      [{ category: "KEYS", location: "Library" }, 0],
    ] as const) {
      const response = await request(app).get("/api/lost-found").set("Authorization", auth).query(query);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(count);
    }
  });

  it("includes legacy posts with no category under Other, including keyword searches", async () => {
    await prisma.$runCommandRaw({ insert: "LostFoundPost", documents: [{
      _id: "legacy", authorId: "student", kind: "LOST", title: "Legacy wallet", description: "Brown leather",
      location: "Library", occurredOn: { $date: "2020-10-01T00:00:00.000Z" },
      status: "OPEN", createdAt: { $date: "2020-10-01T00:00:00.000Z" },
    }] });
    const response = await request(app).get("/api/lost-found?category=OTHER&search=wallet").set("Authorization", auth);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ id: "legacy", category: "OTHER" });
  });

  it("pages without repeating tied timestamps and persists the existing resolve action", async () => {
    await prisma.lostFoundPost.createMany({ data: Array.from({ length: 4 }, (_, index) => ({
      ...body, id: `page${index}`, authorId: "student", occurredOn: new Date("2020-10-01T00:00:00Z"),
      createdAt: new Date("2020-10-03T00:00:00Z"),
    })) });
    const first = await request(app).get("/api/lost-found?limit=2").set("Authorization", auth);
    const second = await request(app).get("/api/lost-found?limit=2&page=2").set("Authorization", auth);
    expect(first.headers["x-has-more"]).toBe("true");
    expect(second.headers["x-has-more"]).toBe("false");
    expect(new Set([...first.body, ...second.body].map((post) => post.id)).size).toBe(4);
    expect([...first.body, ...second.body].map((post) => post.id)).toEqual(["page3", "page2", "page1", "page0"]);
    const id = first.body[0].id;
    expect((await request(app).patch(`/api/lost-found/${id}/resolve`).set("Authorization", auth)).status).toBe(200);
    expect((await prisma.lostFoundPost.findUniqueOrThrow({ where: { id } })).status).toBe("RESOLVED");
  });

  it("creates the intended MongoDB indexes", async () => {
    const indexes = await prisma.$runCommandRaw({ listIndexes: "LostFoundPost" });
    const keys = (indexes.cursor as { firstBatch: { key: unknown }[] }).firstBatch.map((index) => index.key);
    expect(keys).toContainEqual({ createdAt: -1, _id: -1 });
    expect(keys).toContainEqual({ category: 1, createdAt: -1, _id: -1 });
    expect(keys).toContainEqual({ occurredOn: 1 });
  });
});
