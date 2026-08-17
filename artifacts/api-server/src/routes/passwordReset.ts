// @ts-nocheck
import express from "express";
import { db, usersTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const router = express.Router();

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!user) {
    res.json({ message: "If an account with that email exists, a reset token has been generated." });
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    token,
    expiresAt,
  });

  res.json({
    message: "If an account with that email exists, a reset link has been sent. Contact an admin if you need assistance.",
  });
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Token and new password (min 6 chars) are required" });
    return;
  }

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, token),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!resetToken || resetToken.usedAt) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, resetToken.userId));

  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, resetToken.id));

  res.json({ message: "Password reset successfully. You can now log in." });
});

export default router;
