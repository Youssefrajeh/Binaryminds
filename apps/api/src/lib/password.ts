import { z } from "zod";

// Mirrors PASSWORD_RULES in packages/shared/src/password.ts
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one symbol (e.g. # $ % @)");
