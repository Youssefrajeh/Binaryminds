import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { PrismaMock } from "../test/prismaMock.js";
import { prisma as prismaClient } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { createApp } from "../app.js";

vi.mock("../lib/prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});

const prisma = prismaClient as unknown as PrismaMock;
const app = createApp();
const auth = `Bearer ${signToken({ userId: "alice", role: "STUDENT" })}`;

const validBody = {
  title: "Calculus textbook",
  description: "Barely used",
  priceCents: 4500,
  categoryId: "cat1",
  condition: "Good",
  images: [{ url: "a.jpg" }, { url: "b.jpg" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("listings auth", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/listings");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/listings/categories", () => {
  it("returns categories sorted by name", async () => {
    prisma.category.findMany.mockResolvedValue([{ id: "cat1", name: "Books" }]);
    const res = await request(app).get("/api/listings/categories").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: "cat1", name: "Books" }]);
    expect(prisma.category.findMany).toHaveBeenCalledWith({ orderBy: { name: "asc" } });
  });
});

describe("GET /api/listings", () => {
  it("only returns ACTIVE listings with no filters", async () => {
    prisma.listing.findMany.mockResolvedValue([]);
    const res = await request(app).get("/api/listings").set("Authorization", auth);
    expect(res.status).toBe(200);
    const call = prisma.listing.findMany.mock.calls.find((c) => c[0]?.where);
    expect(call?.[0].where).toEqual({ status: "ACTIVE" });
  });

  it("applies search, category and condition filters", async () => {
    prisma.listing.findMany.mockResolvedValue([]);
    await request(app)
      .get("/api/listings?search=calc&categoryId=cat1&condition=Good")
      .set("Authorization", auth);
    const where = prisma.listing.findMany.mock.calls.find((c) => c[0]?.where)?.[0].where;
    expect(where.categoryId).toBe("cat1");
    expect(where.condition).toBe("Good");
    expect(where.OR).toHaveLength(2);
    expect(where.OR[0].title.contains).toBe("calc");
  });
});

describe("GET /api/listings/:id", () => {
  it("returns 404 when missing", async () => {
    prisma.listing.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/listings/x").set("Authorization", auth);
    expect(res.status).toBe(404);
  });

  it("returns 404 for sold listings", async () => {
    prisma.listing.findUnique.mockResolvedValue({ id: "l1", status: "SOLD" });
    const res = await request(app).get("/api/listings/l1").set("Authorization", auth);
    expect(res.status).toBe(404);
  });

  it("returns an active listing", async () => {
    prisma.listing.findUnique.mockResolvedValue({ id: "l1", status: "ACTIVE", title: "T" });
    const res = await request(app).get("/api/listings/l1").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("l1");
  });
});

describe("POST /api/listings", () => {
  it.each([
    ["empty title", { title: "" }],
    ["negative price", { priceCents: -1 }],
    ["fractional price", { priceCents: 1.5 }],
    ["too many images", { images: Array.from({ length: 6 }, (_, i) => ({ url: `${i}.jpg` })) }],
  ])("rejects %s", async (_name, patch) => {
    const res = await request(app)
      .post("/api/listings")
      .set("Authorization", auth)
      .send({ ...validBody, ...patch });
    expect(res.status).toBe(400);
    expect(prisma.listing.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown category", async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    const res = await request(app).post("/api/listings").set("Authorization", auth).send(validBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Category not found");
  });

  it("creates a listing owned by the caller with ordered images", async () => {
    prisma.category.findUnique.mockResolvedValue({ id: "cat1" });
    prisma.listing.create.mockResolvedValue({ id: "l1" });
    const res = await request(app).post("/api/listings").set("Authorization", auth).send(validBody);
    expect(res.status).toBe(201);
    expect(prisma.listing.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sellerId: "alice",
          priceCents: 4500,
          images: {
            create: [
              { url: "a.jpg", sortOrder: 0 },
              { url: "b.jpg", sortOrder: 1 },
            ],
          },
        }),
      }),
    );
  });
});
