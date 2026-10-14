/**
 * Drizzle schema for documents table.
 * Run migrations only after confirming no existing table conflicts.
 */

import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  owner_session_id: text("owner_session_id").notNull(),
  title: text("title").notNull(),
  doc_type: text("doc_type").notNull(), // SOP | WI | OPL
  template: text("template").notNull(),
  content: jsonb("content").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type DocumentInsert = typeof documents.$inferInsert;
export type DocumentSelect = typeof documents.$inferSelect;
