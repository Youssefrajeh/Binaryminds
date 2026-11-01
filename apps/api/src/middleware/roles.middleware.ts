import type { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

/** JWTs can outlive role changes. Always authorize privileged actions from the DB. */
export function requireRoles(...roles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId }, select: { role: true, status: true },
      });
      if (!user || user.status !== "ACTIVE") {
        res.status(401).json({ error: "Account is not active" });
        return;
      }
      req.user.role = user.role;
      if (!roles.includes(user.role)) {
        res.status(403).json({ error: "Your account does not have permission for this action" });
        return;
      }
      next();
    } catch (err) { next(err); }
  };
}
