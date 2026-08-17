// @ts-nocheck
import { db, usersTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const BOT_USERNAME = "Admin Bot";
const BOT_EMAIL = "adminbot@system.internal";
const BOT_LOCKED_HASH = "!!LOCKED!!"; // not a valid bcrypt hash — can never log in

let _botId: number | null = null;

export async function getOrCreateAdminBot(): Promise<number> {
  if (_botId !== null) return _botId;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, BOT_USERNAME))
    .limit(1);

  if (existing) {
    _botId = existing.id;
    logger.info({ botId: _botId }, "Admin Bot user found");
    return _botId;
  }

  const [created] = await db
    .insert(usersTable)
    .values({
      username: BOT_USERNAME,
      email: BOT_EMAIL,
      passwordHash: BOT_LOCKED_HASH,
    })
    .returning({ id: usersTable.id });

  _botId = created.id;
  logger.info({ botId: _botId }, "Admin Bot user created");
  return _botId;
}

export async function sendBotMessage(toUserId: number, content: string): Promise<void> {
  const botId = await getOrCreateAdminBot();
  await db.insert(messagesTable).values({
    senderId: botId,
    receiverId: toUserId,
    content,
    isRead: false,
  });
}

export { BOT_USERNAME };
