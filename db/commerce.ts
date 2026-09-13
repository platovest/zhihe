import type { PurchaseIntentDatabase } from "./intents";

export type OrderStatus = "pending" | "cancelled" | "simulated_paid" | "refund_requested" | "simulated_refunded";
export type Order = {
  id: string;
  amount: 19900;
  currency: "CNY";
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};
const columns = "id,amount,currency,status,created_at AS createdAt,updated_at AS updatedAt";
const initialized = new WeakMap<PurchaseIntentDatabase, Promise<void>>();

export async function ensureCommerce(database: PurchaseIntentDatabase) {
  let pending = initialized.get(database);
  if (!pending) {
    pending = (async () => {
      await database.prepare(`CREATE TABLE IF NOT EXISTS simulation_orders (
        id TEXT PRIMARY KEY,
        session_hash TEXT NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        amount INTEGER NOT NULL CHECK(amount=19900),
        currency TEXT NOT NULL CHECK(currency='CNY'),
        status TEXT NOT NULL CHECK(status IN ('pending','cancelled','simulated_paid','refund_requested','simulated_refunded')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`).run();
      await database.prepare("CREATE INDEX IF NOT EXISTS simulation_orders_session_idx ON simulation_orders(session_hash)").run();
    })();
    initialized.set(database, pending);
    pending.catch(() => initialized.delete(database));
  }
  await pending;
}

export async function sessionOrders(database: PurchaseIntentDatabase, sessionHash: string): Promise<Order[]> {
  await ensureCommerce(database);
  const { results } = await database.prepare(`SELECT ${columns} FROM simulation_orders WHERE session_hash=? ORDER BY created_at DESC,id DESC`).bind(sessionHash).all<Order>();
  return results;
}

export function hasAccess(orders: Order[]) {
  return orders.some((order) => order.status === "simulated_paid" || order.status === "refund_requested");
}

export async function createOrder(database: PurchaseIntentDatabase, sessionHash: string, key: string): Promise<Order | null> {
  await ensureCommerce(database);
  const now = new Date().toISOString();
  // Global idempotency prevents a retry that lost its first Set-Cookie response
  // from creating another order. Another session cannot retrieve that order.
  await database.prepare(`INSERT OR IGNORE INTO simulation_orders
    (id,session_hash,idempotency_key,amount,currency,status,created_at,updated_at)
    VALUES (?,?,?,19900,'CNY','pending',?,?)`).bind(crypto.randomUUID(), sessionHash, key, now, now).run();
  return (await database.prepare(`SELECT ${columns} FROM simulation_orders WHERE session_hash=? AND idempotency_key=?`).bind(sessionHash, key).all<Order>()).results[0] ?? null;
}

export async function findOrder(database: PurchaseIntentDatabase, id: string, sessionHash?: string): Promise<Order | null> {
  await ensureCommerce(database);
  const statement = database.prepare(`SELECT ${columns} FROM simulation_orders WHERE id=?${sessionHash === undefined ? "" : " AND session_hash=?"}`);
  const { results } = await statement.bind(...(sessionHash === undefined ? [id] : [id, sessionHash])).all<Order>();
  return results[0] ?? null;
}

export async function transitionOrder(database: PurchaseIntentDatabase, id: string, from: OrderStatus, to: OrderStatus, sessionHash?: string) {
  await ensureCommerce(database);
  // Conditional update is atomic: late pay/cancel/refund requests cannot revive
  // a terminal order. Access is derived from status, so there is no second write.
  const values = [to, new Date().toISOString(), id, from];
  if (sessionHash !== undefined) values.push(sessionHash);
  await database.prepare(`UPDATE simulation_orders SET status=?,updated_at=? WHERE id=? AND status=?${sessionHash === undefined ? "" : " AND session_hash=?"}`).bind(...values).run();
  return findOrder(database, id, sessionHash);
}

export async function allOrders(database: PurchaseIntentDatabase): Promise<Order[]> {
  await ensureCommerce(database);
  return (await database.prepare(`SELECT ${columns} FROM simulation_orders ORDER BY created_at DESC,id DESC LIMIT 500`).all<Order>()).results;
}

export async function deleteClosedOrder(database: PurchaseIntentDatabase, id: string) {
  await ensureCommerce(database);
  await database.prepare("DELETE FROM simulation_orders WHERE id=? AND status IN ('cancelled','simulated_refunded')").bind(id).run();
}
