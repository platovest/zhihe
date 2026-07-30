import { CONSENT_VERSION, type InterestInput } from "../lib/interest";

let initialized = false;

type Statement = {
  bind(...values: unknown[]): Statement;
  run(): Promise<unknown>;
};

export type PurchaseIntentDatabase = {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
};

async function ensureTable(database: PurchaseIntentDatabase) {
  if (initialized) return;

  await database.batch([
    database.prepare(`
      CREATE TABLE IF NOT EXISTS purchase_intents (
        id TEXT PRIMARY KEY,
        email TEXT COLLATE NOCASE NOT NULL,
        offer_id TEXT NOT NULL,
        source TEXT NOT NULL,
        consent_version TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `),
    database.prepare(`
      CREATE UNIQUE INDEX IF NOT EXISTS purchase_intents_email_offer_idx
      ON purchase_intents (email, offer_id)
    `),
  ]);
  initialized = true;
}

export async function savePurchaseIntent(
  database: PurchaseIntentDatabase,
  input: InterestInput,
) {
  await ensureTable(database);
  await database
    .prepare(
    `INSERT OR IGNORE INTO purchase_intents
      (id, email, offer_id, source, consent_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      input.email,
      input.offerId,
      input.source,
      CONSENT_VERSION,
      new Date().toISOString(),
    )
    .run();
}
