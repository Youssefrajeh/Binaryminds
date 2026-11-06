import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";

/** The web app signs the student out and explains why when it sees this code */
export const SUSPENDED_RESPONSE = { error: "Your account is suspended", code: "ACCOUNT_SUSPENDED" } as const;

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
      };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let payload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  try {
    // Tokens outlive suspensions and deletions, so check the account on each request
    const active = await prisma.user.count({ where: { id: payload.userId, status: "ACTIVE" } });
    if (active === 0) {
      const suspended = await prisma.user.count({ where: { id: payload.userId, status: "SUSPENDED" } });
      res.status(401).json(suspended ? SUSPENDED_RESPONSE : { error: "Account is not active" });
      return;
    }
  } catch (err) {
    next(err);
    return;
  }

  req.user = payload;
  next();
}
