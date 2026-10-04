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

const user = {
  id: "alice",
  email: "alice@student.fanshaweonline.ca",
  role: "STUDENT",
  status: "ACTIVE",
  emailVerifiedAt: new Date("2026-09-01T00:00:00Z"),
  createdAt: new Date("2026-09-01T00:00:00Z"),
  profile: null,
};

// 1x1 transparent PNG
const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

beforeEach(() => vi.clearAllMocks());

describe("profile auth", () => {
  it("requires a token", async () => {
    expect((await request(app).get("/api/profile/me")).status).toBe(401);
  });
});

describe("GET /api/profile/me", () => {
  it("returns 404 when the user is gone", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    expect((await request(app).get("/api/profile/me").set("Authorization", auth)).status).toBe(404);
  });

  it("returns the account and profile", async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    const res = await request(app).get("/api/profile/me").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "alice", email: user.email, profile: null });
  });
});

describe("PUT /api/profile/me", () => {
  it("validates input", async () => {
    const res = await request(app).put("/api/profile/me").set("Authorization", auth).send({ displayName: "" });
    expect(res.status).toBe(400);
    expect(prisma.profile.upsert).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range year", async () => {
    const res = await request(app)
      .put("/api/profile/me")
      .set("Authorization", auth)
      .send({ displayName: "Alice", yearOfStudy: 9 });
    expect(res.status).toBe(400);
  });

  it("upserts the profile", async () => {
    prisma.profile.upsert.mockResolvedValue({ userId: "alice", displayName: "Alice" });
    const res = await request(app)
      .put("/api/profile/me")
      .set("Authorization", auth)
      .send({ displayName: "Alice", program: "CS", interests: ["chess"] });
    expect(res.status).toBe(200);
    expect(prisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "alice" },
        update: expect.objectContaining({ displayName: "Alice", program: "CS", interests: ["chess"] }),
      }),
    );
  });
});

describe("avatar", () => {
  it("rejects non-image data", async () => {
    const res = await request(app).put("/api/profile/me/avatar").set("Authorization", auth).send({ image: "hello" });
    expect(res.status).toBe(400);
  });

  it("rejects images over 300 KB", async () => {
    const big = `data:image/png;base64,${"A".repeat(500 * 1024)}`;
    const res = await request(app).put("/api/profile/me/avatar").set("Authorization", auth).send({ image: big });
    expect(res.status).toBe(400);
  });

  it("saves a valid avatar", async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.profile.upsert.mockResolvedValue({ userId: "alice", avatarUrl: tinyPng });
    const res = await request(app).put("/api/profile/me/avatar").set("Authorization", auth).send({ image: tinyPng });
    expect(res.status).toBe(200);
    expect(prisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { avatarUrl: tinyPng } }),
    );
  });

  it("DELETE returns 404 without a profile", async () => {
    prisma.profile.findUnique.mockResolvedValue(null);
    expect((await request(app).delete("/api/profile/me/avatar").set("Authorization", auth)).status).toBe(404);
  });

  it("DELETE clears the avatar", async () => {
    prisma.profile.findUnique.mockResolvedValue({ userId: "alice" });
    prisma.profile.update.mockResolvedValue({ userId: "alice", avatarUrl: null });
    const res = await request(app).delete("/api/profile/me/avatar").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(prisma.profile.update).toHaveBeenCalledWith({ where: { userId: "alice" }, data: { avatarUrl: null } });
  });
});

describe("GET /api/profile/:userId", () => {
  it("404s for inactive users", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...user, status: "SUSPENDED" });
    expect((await request(app).get("/api/profile/bob").set("Authorization", auth)).status).toBe(404);
  });

  it("returns a public view without email", async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    const res = await request(app).get("/api/profile/alice").set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("alice");
    expect(res.body.email).toBeUndefined();
  });
});
