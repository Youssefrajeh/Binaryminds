import jwt from "jsonwebtoken";
import type { Prisma } from "@prisma/client";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

const SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const EXPIRES_IN = "7d";

interface TokenPayload {
  userId: string;
  role: string;
}

/** What a verified token contains; `iat` is the issue time in whole seconds */
export interface VerifiedToken extends TokenPayload {
  iat?: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): VerifiedToken {
  return jwt.verify(token, SECRET) as VerifiedToken;
}

/**
 * Matches the token's account only while it is active and its password has not
 * changed since the token was issued. `iat` has whole-second precision, so a
 * change in the same second as the token still counts as before it.
 */
export function activeSessionWhere(token: VerifiedToken): Prisma.UserWhereInput {
  const issuedBefore = new Date(((token.iat ?? 0) + 1) * 1000);
  return {
    id: token.userId,
    status: "ACTIVE",
    OR: [
      { passwordChangedAt: null },
      { passwordChangedAt: { isSet: false } },
      { passwordChangedAt: { lt: issuedBefore } },
    ],
  };
}
