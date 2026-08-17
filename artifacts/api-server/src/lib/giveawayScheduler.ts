import { db, giveawaysTable, giveawayEntriesTable, usersTable } from "@workspace/db";
import { eq, and, lt, isNull } from "drizzle-orm";
import pino from "pino";

const logger = pino({ name: "giveaway-scheduler" });

const CHECK_INTERVAL_MS = 60_000; // every 1 minute

async function autoDrawExpiredGiveaways(): Promise<void> {
  const now = new Date();

  const expired = await db
    .select()
    .from(giveawaysTable)
    .where(
      and(
        eq(giveawaysTable.isActive, true),
        lt(giveawaysTable.endDate, now),
        isNull(giveawaysTable.winnerUserId),
      )
    );

  if (expired.length === 0) return;

  logger.info({ count: expired.length }, "Auto-drawing expired giveaways");

  for (const giveaway of expired) {
    try {
      const baseCondition = and(
        eq(giveawayEntriesTable.giveawayId, giveaway.id),
        eq(usersTable.isBanned, false),
      );

      const entries = await db
        .select({ userId: giveawayEntriesTable.userId, username: usersTable.username })
        .from(giveawayEntriesTable)
        .innerJoin(usersTable, eq(giveawayEntriesTable.userId, usersTable.id))
        .where(
          giveaway.autoApprove
            ? baseCondition
            : and(baseCondition, eq(giveawayEntriesTable.isApproved, true))
        );

      if (entries.length === 0) {
        // No eligible entries — just mark inactive
        await db
          .update(giveawaysTable)
          .set({ isActive: false })
          .where(eq(giveawaysTable.id, giveaway.id));
        logger.info({ giveawayId: giveaway.id }, "Giveaway ended with no eligible entries");
        continue;
      }

      const winner = entries[Math.floor(Math.random() * entries.length)];
      await db
        .update(giveawaysTable)
        .set({ winnerUserId: winner.userId, winnerUsername: winner.username, isActive: false })
        .where(eq(giveawaysTable.id, giveaway.id));

      logger.info({ giveawayId: giveaway.id, winner: winner.username }, "Auto-draw complete");
    } catch (e) {
      logger.error({ err: e, giveawayId: giveaway.id }, "Auto-draw failed for giveaway");
    }
  }
}

export { autoDrawExpiredGiveaways };

export function startGiveawayScheduler(): void {
  logger.info("Giveaway auto-draw scheduler started (interval: 1 min)");

  setInterval(async () => {
    try {
      await autoDrawExpiredGiveaways();
    } catch (e) {
      logger.error({ err: e }, "Giveaway scheduler run failed");
    }
  }, CHECK_INTERVAL_MS);

  // Run once shortly after startup
  setTimeout(async () => {
    try {
      await autoDrawExpiredGiveaways();
    } catch (e) {
      logger.error({ err: e }, "Giveaway scheduler initial run failed");
    }
  }, 10_000);
}
