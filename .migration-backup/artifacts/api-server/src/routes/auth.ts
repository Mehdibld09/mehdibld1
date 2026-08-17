// @ts-nocheck
import express from "express";
import { getSetting } from "../lib/settings";
import bcrypt from "bcrypt";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router = express.Router();

function getClientIp(req: Parameters<typeof router.post>[1] extends (req: infer R, ...a: any[]) => any ? R : never): string {
  const forwarded = (req as any).headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return (req as any).socket?.remoteAddress ?? "unknown";
}

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { username, email, password } = parsed.data;
  const ip = (req.headers["x-forwarded-for"] as string || req.socket?.remoteAddress || "unknown").split(",")[0].trim();

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const existingEmail = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existingEmail.length > 0) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const startingPoints = await getSetting("points_registration");
  const [user] = await db
    .insert(usersTable)
    .values({ username, email, passwordHash, registrationIp: ip, points: startingPoints })
    .returning();

  req.session.userId = user.id;
  req.session.isAdmin = user.isAdmin;
  req.session.isModerator = user.isModerator;

  const { passwordHash: _, ...safeUser } = user;
  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: "Session error" });
      return;
    }
    res.status(201).json(safeUser);
  });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }
  const { username, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.isBanned && user.banExpiresAt && new Date() > new Date(user.banExpiresAt)) {
    await db.update(usersTable)
      .set({ isBanned: false, banReason: null, banExpiresAt: null })
      .where(eq(usersTable.id, user.id));
    user.isBanned = false;
    user.banReason = null;
    user.banExpiresAt = null;
  }

  req.session.userId = user.id;
  req.session.isAdmin = user.isAdmin;
  req.session.isModerator = user.isModerator;

  const { passwordHash: _, ...safeUser } = user;
  req.session.save((err) => {
    if (err) {
      res.status(500).json({ error: "Session error" });
      return;
    }
    res.status(200).json(safeUser);
  });
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid", { path: "/" });
    res.json({ message: "Logged out" });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (user.isBanned && user.banExpiresAt && new Date() > new Date(user.banExpiresAt)) {
    await db.update(usersTable)
      .set({ isBanned: false, banReason: null, banExpiresAt: null })
      .where(eq(usersTable.id, user.id));
    user.isBanned = false;
    user.banReason = null;
    user.banExpiresAt = null;
  }

  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

// Update avatar URL and/or display name
router.put("/profile", requireAuth, async (req, res) => {
  const { avatarUrl, displayName } = req.body;
  if (typeof avatarUrl !== "string" && avatarUrl !== null && avatarUrl !== undefined) {
    res.status(400).json({ error: "Invalid avatarUrl" });
    return;
  }
  if (displayName !== undefined && typeof displayName !== "string") {
    res.status(400).json({ error: "Invalid displayName" });
    return;
  }
  const updates: Record<string, any> = {};
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl || null;
  if (displayName !== undefined) {
    const trimmed = displayName.trim();
    if (trimmed && (trimmed.length < 2 || trimmed.length > 30)) {
      res.status(400).json({ error: "Display name must be 2–30 characters" });
      return;
    }
    updates.displayName = trimmed || null;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.session.userId!))
    .returning();
  const { passwordHash: _, ...safeUser } = updated;
  res.json(safeUser);
});

// Change password (requires current password)
router.put("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
    res.status(400).json({ error: "New password must be at least 6 characters" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const newHash = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
  res.json({ message: "Password updated successfully" });
});

// Delete own account
router.delete("/account", requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: "Password required to delete account" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, user.id));
  req.session.destroy(() => {
    res.clearCookie("connect.sid", { path: "/" });
    res.json({ message: "Account deleted" });
  });
});

export default router;
