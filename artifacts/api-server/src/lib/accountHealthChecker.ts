// @ts-nocheck
import { db } from "@workspace/db";
import { accountsTable } from "@workspace/db/schema";
import { eq, lte, or, isNull } from "drizzle-orm";
import { checkSteamCredentials } from "./steamChecker";
import { logger } from "./logger";

// How often to run the health check cycle (every 4 days)
const CHECK_INTERVAL_MS = 4 * 24 * 60 * 60 * 1000;

// How many consecutive failures before auto-deleting the listing
const MAX_FAIL_COUNT = 3;

/**
 * Run one full health check pass across all available accounts.
 * - Skips accounts checked within the last 4 days.
 * - Uses proxy rotation (already built into checkSteamCredentials).
 * - On success: resets healthFailCount to 0, updates lastCheckedAt.
 * - On failure: increments healthFailCount; deletes listing if >= MAX_FAIL_COUNT.
 */
export async function runHealthChecks(): Promise<void> {
  logger.info("Account health check cycle starting");

  const sevenDaysAgo = new Date(Date.now() - CHECK_INTERVAL_MS);

  // Fetch accounts that are available and haven't been checked in the last 4 days
  const accounts = await db
    .select({
      id: accountsTable.id,
      steamUsername: accountsTable.steamUsername,
      steamPassword: accountsTable.steamPassword,
      healthFailCount: accountsTable.healthFailCount,
      lastCheckedAt: accountsTable.lastCheckedAt,
    })
    .from(accountsTable)
    .where(
      or(
        isNull(accountsTable.lastCheckedAt),
        lte(accountsTable.lastCheckedAt, sevenDaysAgo),
      ),
    );

  logger.info({ count: accounts.length }, "Accounts due for health check");

  for (const account of accounts) {
    logger.info({ id: account.id, username: account.steamUsername }, "Checking account health");

    try {
      const result = await checkSteamCredentials(account.steamUsername, account.steamPassword);
      const now = new Date();

      if (result.status === "valid") {
        // Credentials still work — reset fail counter
        await db
          .update(accountsTable)
          .set({ healthFailCount: 0, lastCheckedAt: now })
          .where(eq(accountsTable.id, account.id));

        logger.info({ id: account.id }, "Health check passed — fail counter reset");

      } else if (result.status === "invalid") {
        // Credentials definitively rejected (wrong password / 2FA lockout)
        const newFailCount = account.healthFailCount + 1;

        if (newFailCount >= MAX_FAIL_COUNT) {
          await db.delete(accountsTable).where(eq(accountsTable.id, account.id));
          logger.warn(
            { id: account.id, username: account.steamUsername, reason: result.message },
            `Account deleted after ${MAX_FAIL_COUNT} consecutive health check failures`,
          );
        } else {
          await db
            .update(accountsTable)
            .set({ healthFailCount: newFailCount, lastCheckedAt: now })
            .where(eq(accountsTable.id, account.id));

          logger.warn(
            { id: account.id, failCount: newFailCount, reason: result.message },
            "Health check failed — incrementing fail counter",
          );
        }

      } else {
        // rate_limited or error — Steam unreachable / network issue.
        // Don't penalise the account; just update the timestamp so it's retried next cycle.
        await db
          .update(accountsTable)
          .set({ lastCheckedAt: new Date() })
          .where(eq(accountsTable.id, account.id));

        logger.warn(
          { id: account.id, status: result.status, reason: result.message },
          "Health check inconclusive (network/rate-limit) — skipping penalty",
        );
      }

    } catch (e) {
      logger.error({ err: e, id: account.id }, "Unexpected error during account health check");
    }

    // Brief pause between accounts to avoid hammering Steam
    await new Promise((r) => setTimeout(r, 2_000));
  }

  logger.info("Account health check cycle complete");
}

/**
 * Start the background scheduler.
 * Runs an immediate check on startup, then repeats every 4 days.
 */
export function startHealthCheckScheduler(): void {
  logger.info("Account health check scheduler started (interval: 4 days)");

  // Run first check shortly after startup (1 minute delay so server is fully ready)
  const initialDelay = 60_000;
  setTimeout(async () => {
    try {
      await runHealthChecks();
    } catch (e) {
      logger.error({ err: e }, "Initial health check run failed");
    }
    // Then repeat every 4 days
    setInterval(async () => {
      try {
        await runHealthChecks();
      } catch (e) {
        logger.error({ err: e }, "Scheduled health check run failed");
      }
    }, CHECK_INTERVAL_MS);
  }, initialDelay);
}
