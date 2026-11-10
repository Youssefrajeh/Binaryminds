import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import type { PrismaMock } from "../test/prismaMock.js";
import { prisma as prismaClient } from "../lib/prisma.js";
import { sendEmail } from "../lib/email.js";
import { createApp } from "../app.js";
import { MAX_LOGIN_ATTEMPTS_PER_EMAIL } from "./auth.js";

vi.mock("../lib/prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});

vi.mock("../lib/email.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  isAllowedDomain: (email: string) => email.endsWith("@fanshaweonline.ca"),
}));

// Real hashing would make 30+ login attempts take many seconds
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed"), compare: vi.fn().mockResolvedValue(false) },
}));

const prisma = prismaClient as unknown as PrismaMock;
const app = createApp();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
  prisma.user.findUnique.mockResolvedValue(null);
});

describe("login brute-force protection", () => {
  it("caps attempts on one email even when each guess comes from a different IP address", async () => {
    const email = "target@fanshaweonline.ca";
    const statuses: number[] = [];
    for (let i = 0; i <= MAX_LOGIN_ATTEMPTS_PER_EMAIL; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", `10.0.${Math.floor(i / 250)}.${i % 250}`)
        .send({ email, password: `guess-${i}` });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, MAX_LOGIN_ATTEMPTS_PER_EMAIL).every((status) => status === 401)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it("does not let one email's attempts block another email", async () => {
    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/auth/login").send({ email: "busy@fanshaweonline.ca", password: "x" });
    }
    const res = await request(app).post("/api/auth/login").send({ email: "calm@fanshaweonline.ca", password: "x" });
    expect(res.status).toBe(401);
  });
});

describe("login timing", () => {
  it("still checks a password hash when no account matches, so unknown emails are not faster", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nobody@fanshaweonline.ca", password: "Campus#2026" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
    expect(bcrypt.compare).toHaveBeenCalledOnce();
    expect(vi.mocked(bcrypt.compare).mock.calls[0][0]).toBe("Campus#2026");
  });
});

describe("POST /api/auth/forgot-password", () => {
  const user = { id: "u1", email: "forgetful@fanshaweonline.ca" };

  it("keeps the previous reset code when the email cannot be sent", async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("Brevo is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app).post("/api/auth/forgot-password").send({ email: user.email });

    expect(res.status).toBe(500);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("stores the new code after the email is sent", async () => {
    prisma.user.findUnique.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);

    const res = await request(app).post("/api/auth/forgot-password").send({ email: user.email });

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { otpHash: "hashed", otpExpiresAt: expect.any(Date) },
    });
    expect(vi.mocked(sendEmail).mock.invocationCallOrder[0]).toBeLessThan(prisma.user.update.mock.invocationCallOrder[0]);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("records when the password changed so older sessions stop working", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "u1", otpHash: "code-hash", otpExpiresAt: new Date(Date.now() + 60_000) });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    prisma.user.update.mockResolvedValue({});

    const res = await request(app).post("/api/auth/reset-password").send({ email: "u1@fanshaweonline.ca", otp: "123456", newPassword: "Renewed#2026" });

    expect(res.status).toBe(200);
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({ passwordHash: "hashed", otpHash: null, passwordChangedAt: expect.any(Date) });
  });
});

describe("POST /api/auth/register with a sign-up already pending", () => {
  const signup = { firstName: "Jane", lastName: "Doe", email: "pending@fanshaweonline.ca", password: "Campus#2026", acceptTerms: true };

  it("refuses to replace the password of a sign-up that is still waiting for its code", async () => {
    prisma.pendingRegistration.findUnique.mockResolvedValue({ email: signup.email, passwordHash: "original", otpExpiresAt: new Date(Date.now() + 60_000), firstName: "Jane" });

    const res = await request(app).post("/api/auth/register").send({ ...signup, password: "Attacker#2026" });

    expect(res.status).toBe(409);
    expect(prisma.pendingRegistration.upsert).not.toHaveBeenCalled();
    expect(prisma.pendingRegistration.update).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends a fresh code without touching the password when the same student signs up again", async () => {
    prisma.pendingRegistration.findUnique.mockResolvedValue({ email: signup.email, passwordHash: "original", otpExpiresAt: new Date(Date.now() + 60_000), firstName: "Jane" });
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const res = await request(app).post("/api/auth/register").send(signup);

    expect(res.status).toBe(201);
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(prisma.pendingRegistration.upsert).not.toHaveBeenCalled();
    const update = prisma.pendingRegistration.update.mock.calls[0][0];
    expect(update.data).not.toHaveProperty("passwordHash");
    expect(update.data).toMatchObject({ otpHash: "hashed", otpExpiresAt: expect.any(Date) });
  });
});
