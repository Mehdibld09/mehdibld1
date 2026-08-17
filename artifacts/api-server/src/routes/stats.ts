// @ts-nocheck
import express from "express";
import { db, usersTable, accountsTable, badgesTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";

const router = express.Router();

router.get("/stats", async (_req, res) => {
  // Run all three queries in parallel instead of serially
  const [
    [{ totalUsers, totalPoints }],
    [{ totalAccounts, totalClaims }],
    availableRows,
  ] = await Promise.all([
    db.select({
      totalUsers: sql<number>`count(*)`,
      totalPoints: sql<number>`coalesce(sum(${usersTable.points}), 0)`,
    }).from(usersTable),
    db.select({
      totalAccounts: sql<number>`count(*)`,
      totalClaims: sql<number>`coalesce(sum(${accountsTable.claimsCount}), 0)`,
    }).from(accountsTable),
    db.select({ games: accountsTable.games })
      .from(accountsTable)
      .where(eq(accountsTable.isAvailable, true)),
  ]);

  const counts: Record<string, number> = {};
  for (const row of availableRows) {
    for (const game of row.games ?? []) {
      counts[game] = (counts[game] ?? 0) + 1;
    }
  }

  const topGames = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([game, count]) => ({ game, count }));

  res.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
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
  res.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
  res.json(badges);
});

export default router;
