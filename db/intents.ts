import { CONSENT_VERSION, type InterestInput } from "../lib/interest";

export type Statement = {
  bind(...values: unknown[]): Statement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
};
export type PurchaseIntentDatabase = {
  prepare(query: string): Statement;
  batch(statements: Statement[]): Promise<unknown>;
};

const ready = new WeakMap<PurchaseIntentDatabase, Promise<void>>();
export async function ensureTables(database: PurchaseIntentDatabase) {
  let promise = ready.get(database);
  if (!promise) {
    promise = (async () => {
      await database.prepare(`CREATE TABLE IF NOT EXISTS purchase_intents (
        id TEXT PRIMARY KEY, email TEXT COLLATE NOCASE NOT NULL,
        offer_id TEXT NOT NULL, source TEXT NOT NULL, consent_version TEXT NOT NULL,
        created_at TEXT NOT NULL, withdrawal_hash TEXT, status TEXT NOT NULL DEFAULT 'new'
      )`).run();
      // Upgrade existing local MVP databases without deleting their records.
      const columns = await database.prepare("PRAGMA table_info(purchase_intents)").all<{ name: string }>();
      if (!columns.results.some((column) => column.name === "withdrawal_hash")) {
        await database.prepare("ALTER TABLE purchase_intents ADD COLUMN withdrawal_hash TEXT").run();
      }
      if (!columns.results.some((column) => column.name === "status")) {
        await database.prepare("ALTER TABLE purchase_intents ADD COLUMN status TEXT NOT NULL DEFAULT 'new'").run();
      }
      await database.batch([
        database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS purchase_intents_email_offer_idx ON purchase_intents (email, offer_id)"),
        database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS purchase_intents_withdrawal_idx ON purchase_intents (withdrawal_hash)"),
        database.prepare("CREATE TABLE IF NOT EXISTS funnel_counts (day TEXT NOT NULL, event TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day, event))"),
      ]);
    })();
    ready.set(database, promise);
    promise.catch(() => ready.delete(database));
  }
  await promise;
}

export async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

export async function savePurchaseIntent(database: PurchaseIntentDatabase, input: InterestInput) {
  await ensureTables(database);
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, "0")).join("");
  await database.prepare(`INSERT OR IGNORE INTO purchase_intents
    (id, email, offer_id, source, consent_version, created_at, withdrawal_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), input.email, input.offerId, input.source,
      CONSENT_VERSION, new Date().toISOString(), await hashToken(token)).run();
  // A duplicate must not acquire the original record's withdrawal capability.
  return token;
}

export async function withdrawInterest(database: PurchaseIntentDatabase, token: string) {
  await ensureTables(database);
  await database.prepare("DELETE FROM purchase_intents WHERE withdrawal_hash = ?").bind(await hashToken(token)).run();
}

export const EVENTS = ["visit", "trial_start", "trial_complete", "lesson_start", "lesson_complete", "price_view", "interest_confirmed"] as const;
export async function recordEvent(database: PurchaseIntentDatabase, event: string) {
  await ensureTables(database);
  await database.prepare(`INSERT INTO funnel_counts(day,event,count) VALUES (?,?,1)
    ON CONFLICT(day,event) DO UPDATE SET count=count+1`)
    .bind(new Date().toISOString().slice(0, 10), event).run();
}

export type IntentRow = { id: string; email: string; createdAt: string; status: string; source: string; offerId: string };
export async function readSummary(database: PurchaseIntentDatabase) {
  await ensureTables(database);
  const [total, byStatus, events, interests] = await Promise.all([
    database.prepare("SELECT count(*) AS total FROM purchase_intents").all<{ total: number }>(),
    database.prepare("SELECT status,count(*) AS count FROM purchase_intents GROUP BY status").all(),
    database.prepare("SELECT event,SUM(count) AS count FROM funnel_counts GROUP BY event").all(),
    database.prepare("SELECT id,email,created_at AS createdAt,status,source,offer_id AS offerId FROM purchase_intents ORDER BY created_at DESC LIMIT 500").all<IntentRow>(),
  ]);
  return { total: total.results[0]?.total ?? 0, byStatus: byStatus.results, events: events.results, interests: interests.results };
}

export async function updateStatus(database: PurchaseIntentDatabase, id: string, status: string) {
  await ensureTables(database);
  await database.prepare("UPDATE purchase_intents SET status=? WHERE id=?").bind(status, id).run();
}

export async function deleteInterestById(database: PurchaseIntentDatabase, id: string) {
  await ensureTables(database);
  await database.prepare("DELETE FROM purchase_intents WHERE id=?").bind(id).run();
}

export async function purgeExpired(database: PurchaseIntentDatabase, now = new Date()) {
  await ensureTables(database);
  const cutoff = new Date(now.getTime() - 90 * 86400000).toISOString();
  await database.prepare("DELETE FROM purchase_intents WHERE created_at < ?").bind(cutoff).run();
  return cutoff;
}

export function csvCell(value: string) {
  const safe = /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function exportIntents(database: PurchaseIntentDatabase) {
  await ensureTables(database);
  const { results } = await database.prepare("SELECT id,email,created_at,status,source,offer_id FROM purchase_intents ORDER BY created_at DESC").all<Record<string, string>>();
  const columns = ["id", "email", "created_at", "status", "source", "offer_id"];
  return "\uFEFF" + [columns.join(","), ...results.map((row) => columns.map((key) => csvCell(row[key])).join(","))].join("\r\n");
}
