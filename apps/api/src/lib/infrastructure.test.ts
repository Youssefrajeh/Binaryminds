import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import { corsOptions } from "./cors.js";
import { signToken, verifyToken } from "./jwt.js";
import { generateOtp } from "./otp.js";
import { passwordSchema } from "./password.js";
import { isAllowedDomain, sendEmail } from "./email.js";
import { passwordResetEmailHtml, verificationEmailHtml } from "./email-templates.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { createApp } from "../app.js";

vi.mock("./prisma.js", async () => {
  const { createPrismaMock } = await import("../test/prismaMock.js");
  return { prisma: createPrismaMock() };
});

const envBackup = { ...process.env };
afterEach(() => {
  process.env = { ...envBackup };
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("corsOptions", () => {
  it("reflects any origin when CLIENT_URL is unset", () => {
    delete process.env.CLIENT_URL;
    expect(corsOptions().origin).toBe(true);
  });

  it("splits, trims and strips trailing slashes", () => {
    process.env.CLIENT_URL = "http://a.com/, http://b.com ,";
    expect(corsOptions().origin).toEqual(["http://a.com", "http://b.com"]);
  });
});

describe("jwt", () => {
  it("round-trips a payload", () => {
    const token = signToken({ userId: "u1", role: "STUDENT" });
    expect(verifyToken(token)).toMatchObject({ userId: "u1", role: "STUDENT" });
  });

  it("rejects garbage tokens", () => {
    expect(() => verifyToken("nope")).toThrow();
  });
});

describe("generateOtp", () => {
  it("is always 6 digits", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
});

describe("passwordSchema", () => {
  it.each([
    ["short", "Ab1#"],
    ["no uppercase", "abcdef1#"],
    ["no number", "Abcdefg#"],
    ["no symbol", "Abcdefg1"],
  ])("rejects %s", (_n, pw) => {
    expect(passwordSchema.safeParse(pw).success).toBe(false);
  });

  it("accepts a strong password", () => {
    expect(passwordSchema.safeParse("Str0ng#Pass").success).toBe(true);
  });
});

describe("isAllowedDomain", () => {
  it("allows the default Fanshawe domain, case-insensitively", () => {
    delete process.env.ALLOWED_EMAIL_DOMAIN;
    expect(isAllowedDomain("a@fanshaweonline.ca")).toBe(true);
    expect(isAllowedDomain("A@FanshaweOnline.CA")).toBe(true);
    expect(isAllowedDomain("a@gmail.com")).toBe(false);
    expect(isAllowedDomain("a@evil.fanshaweonline.ca.com")).toBe(false);
  });

  it("honours ALLOWED_EMAIL_DOMAIN", () => {
    process.env.ALLOWED_EMAIL_DOMAIN = "school.edu";
    expect(isAllowedDomain("a@school.edu")).toBe(true);
    expect(isAllowedDomain("a@fanshaweonline.ca")).toBe(false);
  });
});

describe("sendEmail", () => {
  const input = { to: "a@fanshaweonline.ca", subject: "Hi", html: "<p>x</p>" };

  beforeEach(() => {
    for (const k of ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "SMTP_USER", "SMTP_PASS", "BREVO_API_KEY"]) {
      delete process.env[k];
    }
  });

  it("falls back to a console log in dev mode", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await sendEmail(input);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("email:dev-mode"));
  });

  it("sends through Brevo when a key is set", async () => {
    process.env.BREVO_API_KEY = "k";
    process.env.EMAIL_FROM_ADDRESS = "noreply@x.ca";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await sendEmail(input);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.brevo.com/v3/smtp/email",
      expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "api-key": "k" }) }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ to: [{ email: input.to }], subject: "Hi", htmlContent: input.html });
  });

  it("surfaces Brevo failures", async () => {
    process.env.BREVO_API_KEY = "k";
    process.env.EMAIL_FROM_ADDRESS = "noreply@x.ca";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "bad key" }));
    await expect(sendEmail(input)).rejects.toThrow("Brevo send failed (401)");
  });

  it("prefers the Gmail API and surfaces token failures", async () => {
    Object.assign(process.env, {
      GMAIL_CLIENT_ID: "i",
      GMAIL_CLIENT_SECRET: "s",
      GMAIL_REFRESH_TOKEN: "r",
      SMTP_USER: "me@gmail.com",
      BREVO_API_KEY: "ignored",
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "invalid_grant" });
    vi.stubGlobal("fetch", fetchMock);
    await expect(sendEmail(input)).rejects.toThrow("Gmail token refresh failed (400)");
    expect(fetchMock.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
  });
});

describe("email templates", () => {
  it("verification email contains the code and expiry", () => {
    const html = verificationEmailHtml("123456", 10);
    expect(html).toContain("123456");
    expect(html).toContain("10");
  });

  it("reset email contains the code and expiry", () => {
    const html = passwordResetEmailHtml("654321", 15);
    expect(html).toContain("654321");
    expect(html).toContain("15");
  });
});

describe("requireAuth middleware", () => {
  const app = express();
  app.get("/p", requireAuth, (req, res) => res.json(req.user));

  it("rejects a missing header", async () => {
    expect((await request(app).get("/p")).status).toBe(401);
  });

  it("rejects a non-Bearer header", async () => {
    expect((await request(app).get("/p").set("Authorization", "Basic abc")).status).toBe(401);
  });

  it("rejects an invalid token", async () => {
    const res = await request(app).get("/p").set("Authorization", "Bearer bad");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired token");
  });

  it("attaches the user for a valid token", async () => {
    const token = signToken({ userId: "u1", role: "STUDENT" });
    const res = await request(app).get("/p").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ userId: "u1", role: "STUDENT" });
  });
});

describe("health route", () => {
  it("is public and mounted under /api and /", async () => {
    const app = createApp();
    for (const path of ["/api/health", "/health"]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "ok", service: "campushub-api" });
    }
  });
});
