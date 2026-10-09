import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const emailLogsTable = pgTable("email_logs", {
  id: serial("id").primaryKey(),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  purpose: text("purpose").notNull().default("other"), // '2fa_login' | 'verify_email' | 'password_reset' | 'smtp_test' | 'other'
  status: text("status").notNull().default("success"), // 'success' | 'failed'
  durationMs: integer("duration_ms").notNull().default(0),
  messageId: text("message_id"),
  error: text("error"),
  provider: text("provider"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmailLog = typeof emailLogsTable.$inferSelect;
export type InsertEmailLog = typeof emailLogsTable.$inferInsert;
