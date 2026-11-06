import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signToken } from "../lib/jwt.js";
import { prisma as client } from "../lib/prisma.js";
import { disconnectUser } from "../socket/io.js";
import type { PrismaMock } from "../test/prismaMock.js";

vi.mock("../lib/prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});
vi.mock("../socket/io.js", async (original) => ({ ...(await original<typeof import("../socket/io.js")>()), disconnectUser: vi.fn() }));
const prisma = client as unknown as PrismaMock;
const app = createApp();
const auth = `Bearer ${signToken({ userId: "admin", role: "ADMINISTRATOR" })}`;
const student = { id: "student", role: "STUDENT", status: "ACTIVE", emailVerifiedAt: new Date(), email: "s@fanshaweonline.ca" };

beforeEach(() => {
  vi.resetAllMocks();
  prisma.user.count.mockResolvedValue(1);
  prisma.user.findUnique.mockResolvedValue({ role: "ADMINISTRATOR", status: "ACTIVE" });
});

describe("admin user management", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/admin/users")).status).toBe(401);
  });
  it.each(["STUDENT", "ORGANIZER"])("rejects %s even with an Administrator role in the token", async (role) => {
    prisma.user.findUnique.mockResolvedValue({ role, status: "ACTIVE" });
    expect((await request(app).get("/api/admin/users").set("Authorization", auth)).status).toBe(403);
    expect((await request(app).patch("/api/admin/users/student/role").set("Authorization", auth).send({ role: "ORGANIZER" })).status).toBe(403);
  });
  it("searches names/emails and role without selecting secrets", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    const response = await request(app).get("/api/admin/users?search=Sam&role=STUDENT").set("Authorization", auth);
    expect(response.status).toBe(200);
    const args = prisma.user.findMany.mock.calls[0][0];
    expect(args.where.role).toBe("STUDENT");
    expect(args.where.OR).toHaveLength(2);
    expect(args.select).not.toHaveProperty("passwordHash");
    expect(args.select).not.toHaveProperty("otpHash");
  });
  it.each(["ORGANIZER", "STUDENT", "ADMINISTRATOR"])("assigns %s to a non-admin account", async (role) => {
    prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMINISTRATOR", status: "ACTIVE" }).mockResolvedValueOnce(student);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ ...student, role });
    const response = await request(app).patch("/api/admin/users/student/role").set("Authorization", auth).send({ role });
    expect(response.status).toBe(200);
    expect(response.body.role).toBe(role);
    expect(prisma.user.updateMany.mock.calls[0][0].data).toEqual({ role });
  });
  it("rejects unsupported roles", async () => {
    expect((await request(app).patch("/api/admin/users/student/role").set("Authorization", auth).send({ role: "SUPERUSER" })).status).toBe(400);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("protects existing administrator accounts from demotion", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMINISTRATOR", status: "ACTIVE" }).mockResolvedValueOnce({ ...student, role: "ADMINISTRATOR" });
    expect((await request(app).patch("/api/admin/users/student/role").set("Authorization", auth).send({ role: "STUDENT" })).status).toBe(403);
  });
  it.each(["ORGANIZER", "ADMINISTRATOR"])("requires verification and active status before granting %s", async (role) => {
    for (const fields of [{ emailVerifiedAt: null }, { status: "SUSPENDED" }]) {
      prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMINISTRATOR", status: "ACTIVE" }).mockResolvedValueOnce({ ...student, ...fields });
      expect((await request(app).patch("/api/admin/users/student/role").set("Authorization", auth).send({ role })).status).toBe(409);
    }
  });
  it("handles missing users", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMINISTRATOR", status: "ACTIVE" }).mockResolvedValueOnce(null);
    expect((await request(app).patch("/api/admin/users/missing/role").set("Authorization", auth).send({ role: "ORGANIZER" })).status).toBe(404);
  });
  it("does not overwrite a concurrently changed account", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMINISTRATOR", status: "ACTIVE" }).mockResolvedValueOnce(student);
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    expect((await request(app).patch("/api/admin/users/student/role").set("Authorization", auth).send({ role: "ORGANIZER" })).status).toBe(409);
  });
});

describe("admin account suspension", () => {
  const url = "/api/admin/users/student/status";
  const targets = (target: unknown) => prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMINISTRATOR", status: "ACTIVE" }).mockResolvedValueOnce(target);

  it("requires an administrator", async () => {
    expect((await request(app).patch(url).send({ status: "SUSPENDED" })).status).toBe(401);
    prisma.user.findUnique.mockResolvedValue({ role: "STUDENT", status: "ACTIVE" });
    expect((await request(app).patch(url).set("Authorization", auth).send({ status: "SUSPENDED" })).status).toBe(403);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("suspends an active account and ends its live connections", async () => {
    targets(student);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ ...student, status: "SUSPENDED" });
    const response = await request(app).patch(url).set("Authorization", auth).send({ status: "SUSPENDED" });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("SUSPENDED");
    expect(prisma.user.updateMany.mock.calls[0][0]).toEqual({ where: { id: "student", role: "STUDENT", status: "ACTIVE" }, data: { status: "SUSPENDED", suspendedAt: expect.any(Date), suspendedReason: null, suspendedById: "admin" } });
    expect(disconnectUser).toHaveBeenCalledWith("student");
  });
  it("reactivates a suspended account", async () => {
    targets({ ...student, status: "SUSPENDED" });
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue(student);
    const response = await request(app).patch(url).set("Authorization", auth).send({ status: "ACTIVE" });
    expect(response.status).toBe(200);
    expect(prisma.user.updateMany.mock.calls[0][0].data).toEqual({ status: "ACTIVE", suspendedAt: null, suspendedReason: null, suspendedById: null });
    expect(disconnectUser).not.toHaveBeenCalled();
  });
  it("records an optional suspension reason", async () => {
    targets(student);
    prisma.user.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUniqueOrThrow.mockResolvedValue({ ...student, status: "SUSPENDED", suspendedReason: "Selling stolen goods" });
    const response = await request(app).patch(url).set("Authorization", auth).send({ status: "SUSPENDED", reason: "  Selling stolen goods  " });
    expect(response.status).toBe(200);
    expect(prisma.user.updateMany.mock.calls[0][0].data).toMatchObject({ suspendedReason: "Selling stolen goods" });
  });
  it("rejects an overly long suspension reason", async () => {
    const response = await request(app).patch(url).set("Authorization", auth).send({ status: "SUSPENDED", reason: "x".repeat(501) });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Keep the reason under 500 characters");
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("does not let an administrator suspend their own account", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ role: "ADMINISTRATOR", status: "ACTIVE" }).mockResolvedValueOnce({ ...student, id: "admin" });
    expect((await request(app).patch("/api/admin/users/admin/status").set("Authorization", auth).send({ status: "SUSPENDED" })).status).toBe(403);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("rejects other statuses", async () => {
    expect((await request(app).patch(url).set("Authorization", auth).send({ status: "PENDING" })).status).toBe(400);
  });
  it("cannot activate an unverified account by reactivating it", async () => {
    targets({ ...student, status: "PENDING", emailVerifiedAt: null });
    expect((await request(app).patch(url).set("Authorization", auth).send({ status: "ACTIVE" })).status).toBe(409);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("rejects repeating the current status", async () => {
    targets({ ...student, status: "SUSPENDED" });
    expect((await request(app).patch(url).set("Authorization", auth).send({ status: "SUSPENDED" })).status).toBe(409);
  });
  it("protects administrator accounts", async () => {
    targets({ ...student, role: "ADMINISTRATOR" });
    expect((await request(app).patch(url).set("Authorization", auth).send({ status: "SUSPENDED" })).status).toBe(403);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });
  it("handles missing users and concurrent changes", async () => {
    targets(null);
    expect((await request(app).patch(url).set("Authorization", auth).send({ status: "SUSPENDED" })).status).toBe(404);
    targets(student);
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    expect((await request(app).patch(url).set("Authorization", auth).send({ status: "SUSPENDED" })).status).toBe(409);
    expect(disconnectUser).not.toHaveBeenCalled();
  });
});
