// @ts-nocheck
import { db, notificationsTable } from "@workspace/db";

const BOT_USERNAME = "Admin Bot";

export async function sendBotMessage(toUserId: number, content: string): Promise<void> {
  await db.insert(notificationsTable).values({
    userId: toUserId,
    type: "admin_update",
    actorUsername: BOT_USERNAME,
    message: content,
    linkUrl: null,
    isRead: false,
  });
}

export { BOT_USERNAME };
