import { sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const purchaseIntents = sqliteTable(
  "purchase_intents",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    offerId: text("offer_id").notNull(),
    source: text("source").notNull(),
    consentVersion: text("consent_version").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("purchase_intents_email_offer_idx").on(
      table.email,
      table.offerId,
    ),
  ],
);
