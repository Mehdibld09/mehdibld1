// @ts-nocheck
import express from "express";
import { db, usersTable, accountsTable, badgesTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router = express.Router();

router.get("/stats", async (_req, res) => {
  const [{ totalUsers }] = await db
    .select({ totalUsers: sql<number>`count(*)` })
    .from(usersTable);

  const [{ totalAccounts }] = await db
    .select({ totalAccounts: sql<number>`count(*)` })
    .from(accountsTable);

  const [{ totalClaims }] = await db
    .select({ totalClaims: sql<number>`coalesce(sum(${accountsTable.claimsCount}), 0)` })
    .from(accountsTable);

  const [{ totalPoints }] = await db
    .select({ totalPoints: sql<number>`coalesce(sum(${usersTable.points}), 0)` })
    .from(usersTable);

  const rows = await db
    .select({ games: accountsTable.games })
    .from(accountsTable)
    .where(eq(accountsTable.isAvailable, true));

  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const game of row.games ?? []) {
      counts[game] = (counts[game] ?? 0) + 1;
    }
  }

  const topGames = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([game, count]) => ({ game, count }));

  res.json({
    totalUsers: Number(totalUsers),
    totalAccounts: Number(totalAccounts),
    totalClaims: Number(totalClaims),
    totalPointsCirculating: Number(totalPoints),
    topGames,
  });
});

router.get("/badges", async (_req, res) => {
  const badges = await db.select().from(badgesTable).orderBy(badgesTable.xpThreshold);
  res.json(badges);
});

export default router;
