import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { PrismaMock } from "../test/prismaMock.js";
import { prisma as prismaClient } from "../lib/prisma.js";
import { sendEmail } from "../lib/email.js";
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

const signup = { email: "a_student@fanshaweonline.ca", password: "Campus#2026" };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockResolvedValue(null);
  prisma.pendingRegistration.upsert.mockResolvedValue({});
});

describe("POST /api/auth/register — Terms and Conditions", () => {
  it.each([
    ["missing", {}],
    ["false", { acceptTerms: false }],
    ["not a boolean", { acceptTerms: "yes" }],
  ])("rejects sign-up when acceptTerms is %s", async (_label, extra) => {
    const res = await request(app).post("/api/auth/register").send({ ...signup, ...extra });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("You must accept the Terms and Conditions to sign up");
    expect(prisma.pendingRegistration.upsert).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("records when the terms were accepted", async () => {
    const res = await request(app).post("/api/auth/register").send({ ...signup, acceptTerms: true });

    expect(res.status).toBe(201);
    const call = prisma.pendingRegistration.upsert.mock.calls[0][0];
    expect(call.create.termsAcceptedAt).toBeInstanceOf(Date);
    expect(call.update.termsAcceptedAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledOnce();
  });
});
