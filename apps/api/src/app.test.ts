import { createServer } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { PrismaMock } from "./test/prismaMock.js";
import { prisma as prismaClient } from "./lib/prisma.js";
import { signToken } from "./lib/jwt.js";
import { createApp } from "./app.js";

vi.mock("./lib/prisma.js", async () => {
  const { createPrismaMock } = await import("./test/prismaMock.js");
  return { prisma: createPrismaMock() };
});

const prisma = prismaClient as unknown as PrismaMock;
const app = createApp();
const auth = `Bearer ${signToken({ userId: "alice", role: "STUDENT" })}`;

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.count.mockResolvedValue(1);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("error responses", () => {
  it("answers malformed JSON with a JSON error and no stack trace", async () => {
    const res = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send('{"email": bad json');

    expect(res.status).toBe(400);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: "The request body is not valid JSON" });
    expect(res.text).not.toMatch(/at JSON\.parse|node_modules|SyntaxError/);
  });

  it("answers an unexpected failure with a generic 500 and logs the details", async () => {
    // The session check fails because the database is unreachable
    prisma.user.count.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:27017"));

    const res = await request(app).get("/api/profile/me").set("Authorization", auth);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    expect(res.text).not.toContain("ECONNREFUSED");
    expect(console.error).toHaveBeenCalled();
  });
});

describe("request size limits", () => {
  const big = (bytes: number) => ({ email: "a@fanshaweonline.ca", password: "x".repeat(bytes) });

  it("rejects large bodies on routes that never need them", async () => {
    const res = await request(app).post("/api/auth/login").send(big(200 * 1024));

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: "The request is too large" });
  });

  it("does not read a large upload before the sender has signed in", async () => {
    // Supertest asks for Connection: close by default. Node then closes the
    // socket after the 401 while the upload is still arriving, and the client
    // sees ECONNRESET. Browsers and Render's proxy keep the connection open,
    // so the test does the same, on a server that stays up until it finishes.
    const server = createServer(app).listen(0);
    try {
      const res = await request(server).post("/api/listings").set("Connection", "keep-alive")
        .send({ title: "x".repeat(2 * 1024 * 1024) });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Authentication required");
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("accepts a large upload from a signed-in student", async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    // About 2 MB: over the default limit, within the listing limit
    const res = await request(app).post("/api/listings").set("Authorization", auth)
      .send({ title: "Desk", description: "x".repeat(2 * 1024 * 1024), priceCents: 100, categoryId: "c1", condition: "GOOD", images: [] });

    // Parsed and validated rather than refused for size
    expect(res.status).toBe(400);
    expect(res.body.error).not.toBe("The request is too large");
  });

  it("still caps uploads at each route's own limit", async () => {
    const res = await request(app).post("/api/lost-found").set("Authorization", auth).send({ title: "x".repeat(5 * 1024 * 1024) });

    expect(res.status).toBe(413);
  });
});
