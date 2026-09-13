import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const purchaseIntents = sqliteTable(
  "purchase_intents",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    offerId: text("offer_id").notNull(),
    source: text("source").notNull(),
    consentVersion: text("consent_version").notNull(),
    createdAt: text("created_at").notNull(),
    withdrawalHash: text("withdrawal_hash"),
    status: text("status").notNull().default("new"),
  },
  (table) => [
    uniqueIndex("purchase_intents_withdrawal_idx").on(table.withdrawalHash),
    uniqueIndex("purchase_intents_email_offer_idx").on(
      table.email,
      table.offerId,
    ),
  ],
);

export const funnelCounts = sqliteTable("funnel_counts", {
  day: text("day").notNull(),
  event: text("event").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.day, table.event] })]);
