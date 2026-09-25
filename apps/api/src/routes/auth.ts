import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../lib/jwt.js";
import { generateOtp } from "../lib/otp.js";
import { sendEmail, isAllowedDomain } from "../lib/email.js";
import { verificationEmailHtml, passwordResetEmailHtml } from "../lib/email-templates.js";

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 15;

/* ------------------------------------------------------------------ */
/*  Validation schemas                                                 */
/* ------------------------------------------------------------------ */

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifySchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

const forgotSchema = z.object({
  email: z.string().email(),
});

const resetSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function userToDto(user: {
  id: string;
  email: string;
  role: string;
  status: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  profile?: {
    displayName: string;
    program: string | null;
    yearOfStudy: number | null;
    bio: string | null;
    avatarUrl: string | null;
    interests: string[];
  } | null;
}) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    profile: user.profile ?? null,
  };
}

async function generateAndStoreOtp(userId: string): Promise<string> {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
  const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: { otpHash, otpExpiresAt },
  });

  return otp;
}

/* ------------------------------------------------------------------ */
/*  POST /auth/register                                                */
/* ------------------------------------------------------------------ */

authRouter.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password } = parsed.data;

    if (!isAllowedDomain(email)) {
      res.status(400).json({ error: "Only Fanshawe student email addresses are allowed" });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.status !== "PENDING") {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    if (existing) {
      await prisma.user.delete({ where: { id: existing.id } });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await prisma.pendingRegistration.upsert({
      where: { email },
      create: { email, passwordHash, otpHash, otpExpiresAt },
      update: { passwordHash, otpHash, otpExpiresAt, createdAt: new Date() },
    });

    try {
      await sendEmail({
        to: email,
        subject: "CampusHub — Verify your email",
        html: verificationEmailHtml(otp, OTP_EXPIRY_MINUTES),
      });
    } catch (err) {
      await prisma.pendingRegistration.delete({ where: { email } }).catch(() => {});
      throw err;
    }

    res.status(201).json({ message: "Check your email for the verification code." });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /auth/verify                                                  */
/* ------------------------------------------------------------------ */

authRouter.post("/verify", async (req, res) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, otp } = parsed.data;

    const pending = await prisma.pendingRegistration.findUnique({ where: { email } });

    if (!pending) {
      res.status(400).json({ error: "Invalid verification request" });
      return;
    }

    if (new Date() > pending.otpExpiresAt) {
      await prisma.pendingRegistration.delete({ where: { email } });
      res.status(400).json({ error: "Verification code has expired. Please sign up again." });
      return;
    }

    const valid = await bcrypt.compare(otp, pending.otpHash);
    if (!valid) {
      res.status(400).json({ error: "Invalid verification code" });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await prisma.pendingRegistration.delete({ where: { email } });
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const updated = await prisma.user.create({
      data: {
        email,
        passwordHash: pending.passwordHash,
        emailVerifiedAt: new Date(),
        status: "ACTIVE",
      },
      include: { profile: true },
    });
    await prisma.pendingRegistration.delete({ where: { email } });

    const token = signToken({ userId: updated.id, role: updated.role });

    res.json({ token, user: userToDto(updated) });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /auth/login                                                   */
/* ------------------------------------------------------------------ */

authRouter.post("/login", async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.status === "PENDING") {
      res.status(403).json({ error: "Please verify your email before logging in" });
      return;
    }

    if (user.status === "SUSPENDED") {
      res.status(403).json({ error: "Your account has been suspended" });
      return;
    }

    const token = signToken({ userId: user.id, role: user.role });

    res.json({ token, user: userToDto(user) });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /auth/logout (stateless — client clears token)                */
/* ------------------------------------------------------------------ */

authRouter.post("/logout", (_req, res) => {
  res.json({ message: "Logged out" });
});

/* ------------------------------------------------------------------ */
/*  POST /auth/forgot-password                                         */
/* ------------------------------------------------------------------ */

authRouter.post("/forgot-password", async (req, res) => {
  try {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { email } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ message: "If that email is registered, a reset code has been sent." });
      return;
    }

    const otp = await generateAndStoreOtp(user.id);

    await sendEmail({
      to: email,
      subject: "CampusHub — Reset your password",
      html: passwordResetEmailHtml(otp, OTP_EXPIRY_MINUTES),
    });

    res.json({ message: "If that email is registered, a reset code has been sent." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ------------------------------------------------------------------ */
/*  POST /auth/reset-password                                          */
/* ------------------------------------------------------------------ */

authRouter.post("/reset-password", async (req, res) => {
  try {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const { email, otp, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.otpHash || !user.otpExpiresAt) {
      res.status(400).json({ error: "Invalid reset request" });
      return;
    }

    if (new Date() > user.otpExpiresAt) {
      res.status(400).json({ error: "Reset code has expired. Please request a new one." });
      return;
    }

    const valid = await bcrypt.compare(otp, user.otpHash);
    if (!valid) {
      res.status(400).json({ error: "Invalid reset code" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        otpHash: null,
        otpExpiresAt: null,
      },
    });

    res.json({ message: "Password has been reset. You can now log in." });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
