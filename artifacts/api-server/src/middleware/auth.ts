import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const JWT_SECRET = process.env.JWT_SECRET || "billingpro-secret-key-change-in-production";

export interface AuthUser {
  id: number;
  username: string;
  role: "master" | "admin" | "salesman";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: Array<"master" | "admin" | "salesman">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

export function requireMaster(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "master") {
    res.status(403).json({ error: "Master access required" });
    return;
  }
  next();
}

export function requireAdminOrMaster(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || (req.user.role !== "master" && req.user.role !== "admin")) {
    res.status(403).json({ error: "Admin or Master access required" });
    return;
  }
  next();
}

import { db } from "@workspace/db";
import { salesmanPermissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

type SalesmanPermKey = "canBill" | "canViewReports" | "canEditInvoices" | "canAccessInventory";

export function requireSalesmanPermission(permission: SalesmanPermKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (req.user.role === "master" || req.user.role === "admin") {
      next();
      return;
    }
    const [perms] = await db.select().from(salesmanPermissionsTable).where(eq(salesmanPermissionsTable.userId, req.user.id));
    if (!perms || !perms[permission]) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}
