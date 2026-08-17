// @ts-nocheck
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user?.isAdmin) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  req.session.isAdmin = true;
  next();
}

export async function requireModOrAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session?.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select({ isAdmin: usersTable.isAdmin, isModerator: usersTable.isModerator }).from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
  if (!user?.isAdmin && !user?.isModerator) {
    res.status(403).json({ error: "Moderator or admin access required" });
    return;
  }
  req.session.isAdmin = user.isAdmin;
  req.session.isModerator = user.isModerator;
  next();
}
