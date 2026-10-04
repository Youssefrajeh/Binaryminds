import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import type { PrismaMock } from "../test/prismaMock.js";
import { prisma as prismaClient } from "../lib/prisma.js";
import { sendEmail } from "../lib/email.js";
import { verifyToken } from "../lib/jwt.js";
import { createApp } from "../app.js";

vi.mock("../lib/prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});

vi.mock("../lib/email.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  isAllowedDomain: (email: string) => email.endsWith("@fanshaweonline.ca"),
}));

const prisma = prismaClient as unknown as PrismaMock;
const app = createApp();

const email = "a_student@fanshaweonline.ca";
const password = "Campus#2026";
const future = () => new Date(Date.now() + 60_000);
const past = () => new Date(Date.now() - 60_000);
// Skip 6-digit hex colours (#111318) in the template's inline styles
const otpFrom = (html: string) => html.match(/(?<![#\w])\d{6}(?!\w)/)?.[0] ?? "";

let passwordHash: string;
let otpHash: string;

const baseUser = () => ({
  id: "u1",
  email,
  role: "STUDENT",
  status: "ACTIVE",
  passwordHash,
  emailVerifiedAt: new Date("2026-09-01T00:00:00Z"),
  createdAt: new Date("2026-09-01T00:00:00Z"),
  profile: null,
  otpHash: null as string | null,
  otpExpiresAt: null as Date | null,
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  passwordHash = await bcrypt.hash(password, 4);
  otpHash = await bcrypt.hash("123456", 4);
  prisma.user.findUnique.mockResolvedValue(null);
});

describe("POST /api/auth/register", () => {
  const body = { email, password, acceptTerms: true };

  it("rejects non-Fanshawe emails", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...body, email: "x@gmail.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Fanshawe");
  });

  it("rejects weak passwords", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...body, password: "weak" });
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid email format", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...body, email: "nope" });
    expect(res.status).toBe(400);
  });

  it("returns 409 when an active account exists", async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser());
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(409);
    expect(prisma.pendingRegistration.upsert).not.toHaveBeenCalled();
  });

  it("replaces a stale PENDING user", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser(), status: "PENDING" });
    prisma.pendingRegistration.upsert.mockResolvedValue({});
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(201);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u1" } });
  });

  it("stores hashes (never the plain password/OTP) and emails the code", async () => {
    prisma.pendingRegistration.upsert.mockResolvedValue({});
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(201);
    const { create } = prisma.pendingRegistration.upsert.mock.calls[0][0];
    expect(create.passwordHash).not.toBe(password);
    expect(await bcrypt.compare(password, create.passwordHash)).toBe(true);
    expect(create.otpExpiresAt.getTime()).toBeGreaterThan(Date.now());

    const mail = vi.mocked(sendEmail).mock.calls[0][0];
    const code = otpFrom(mail.html);
    expect(await bcrypt.compare(code, create.otpHash)).toBe(true);
    expect(mail.to).toBe(email);
  });

  it("removes the pending registration when the email fails", async () => {
    prisma.pendingRegistration.upsert.mockResolvedValue({});
    prisma.pendingRegistration.delete.mockResolvedValue({});
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("smtp down"));
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(500);
    expect(prisma.pendingRegistration.delete).toHaveBeenCalledWith({ where: { email } });
  });
});

describe("POST /api/auth/verify", () => {
  const pending = () => ({
    email,
    passwordHash: "ph",
    otpHash,
    otpExpiresAt: future(),
    termsAcceptedAt: new Date(),
  });

  it("validates the OTP length", async () => {
    const res = await request(app).post("/api/auth/verify").send({ email, otp: "12" });
    expect(res.status).toBe(400);
  });

  it("rejects when there is no pending registration", async () => {
    prisma.pendingRegistration.findUnique.mockResolvedValue(null);
    const res = await request(app).post("/api/auth/verify").send({ email, otp: "123456" });
    expect(res.status).toBe(400);
  });

  it("rejects and deletes an expired code", async () => {
    prisma.pendingRegistration.findUnique.mockResolvedValue({ ...pending(), otpExpiresAt: past() });
    const res = await request(app).post("/api/auth/verify").send({ email, otp: "123456" });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("expired");
    expect(prisma.pendingRegistration.delete).toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects a wrong code", async () => {
    prisma.pendingRegistration.findUnique.mockResolvedValue(pending());
    const res = await request(app).post("/api/auth/verify").send({ email, otp: "000000" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid verification code");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("returns 409 if the user already exists", async () => {
    prisma.pendingRegistration.findUnique.mockResolvedValue(pending());
    prisma.user.findUnique.mockResolvedValue(baseUser());
    const res = await request(app).post("/api/auth/verify").send({ email, otp: "123456" });
    expect(res.status).toBe(409);
  });

  it("creates an ACTIVE user and returns a valid token", async () => {
    prisma.pendingRegistration.findUnique.mockResolvedValue(pending());
    prisma.user.create.mockResolvedValue(baseUser());
    const res = await request(app).post("/api/auth/verify").send({ email, otp: "123456" });
    expect(res.status).toBe(200);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email, status: "ACTIVE", passwordHash: "ph" }) }),
    );
    expect(verifyToken(res.body.token)).toMatchObject({ userId: "u1" });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(prisma.pendingRegistration.delete).toHaveBeenCalledWith({ where: { email } });
  });
});

describe("POST /api/auth/login", () => {
  it("validates input", async () => {
    expect((await request(app).post("/api/auth/login").send({ email: "bad", password: "" })).status).toBe(400);
  });

  it("gives the same error for unknown user and wrong password", async () => {
    const unknown = await request(app).post("/api/auth/login").send({ email, password });
    prisma.user.findUnique.mockResolvedValue(baseUser());
    const wrong = await request(app).post("/api/auth/login").send({ email, password: "Wrong#Pass1" });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toBe(wrong.body.error);
  });

  it("blocks PENDING accounts", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser(), status: "PENDING" });
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(403);
  });

  it("blocks SUSPENDED accounts", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser(), status: "SUSPENDED" });
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(403);
    expect(res.body.error).toContain("suspended");
  });

  it("returns a token and a user without secrets", async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser());
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(verifyToken(res.body.token)).toMatchObject({ userId: "u1", role: "STUDENT" });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.otpHash).toBeUndefined();
  });
});

describe("POST /api/auth/logout", () => {
  it("succeeds statelessly", async () => {
    expect((await request(app).post("/api/auth/logout")).status).toBe(200);
  });
});

describe("POST /api/auth/forgot-password", () => {
  it("validates the email", async () => {
    expect((await request(app).post("/api/auth/forgot-password").send({ email: "x" })).status).toBe(400);
  });

  it("does not reveal whether an email exists", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(res.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("stores a hashed OTP and emails it", async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser());
    prisma.user.update.mockResolvedValue({});
    const res = await request(app).post("/api/auth/forgot-password").send({ email });
    expect(res.status).toBe(200);
    const data = prisma.user.update.mock.calls[0][0].data;
    const code = otpFrom(vi.mocked(sendEmail).mock.calls[0][0].html);
    expect(await bcrypt.compare(code, data.otpHash)).toBe(true);
    expect(data.otpExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("POST /api/auth/reset-password", () => {
  const body = { email, otp: "123456", newPassword: "NewPass#2026" };

  it("rejects a weak new password", async () => {
    const res = await request(app).post("/api/auth/reset-password").send({ ...body, newPassword: "weak" });
    expect(res.status).toBe(400);
  });

  it("rejects when no reset was requested", async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser());
    expect((await request(app).post("/api/auth/reset-password").send(body)).status).toBe(400);
  });

  it("rejects an expired code", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser(), otpHash, otpExpiresAt: past() });
    const res = await request(app).post("/api/auth/reset-password").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("expired");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rejects a wrong code", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser(), otpHash, otpExpiresAt: future() });
    const res = await request(app).post("/api/auth/reset-password").send({ ...body, otp: "000000" });
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("sets the new password and clears the OTP", async () => {
    prisma.user.findUnique.mockResolvedValue({ ...baseUser(), otpHash, otpExpiresAt: future() });
    prisma.user.update.mockResolvedValue({});
    const res = await request(app).post("/api/auth/reset-password").send(body);
    expect(res.status).toBe(200);
    const { data } = prisma.user.update.mock.calls[0][0];
    expect(await bcrypt.compare(body.newPassword, data.passwordHash)).toBe(true);
    expect(data.otpHash).toBeNull();
    expect(data.otpExpiresAt).toBeNull();
  });
});
