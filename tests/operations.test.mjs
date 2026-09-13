import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "./sqlite-database.mjs";

const { default: worker } = await import("../dist/server/index.js");
const adminToken = "test-only-admin-token-at-least-32-characters";
const valid = { email: "buyer@example.com", offerId: "overseas-launch-v2", source: "direct", consent: true, website: "" };
const auth = { authorization: `Bearer ${adminToken}` };
function api(database, path, method = "GET", body, headers = {}, token = adminToken) {
  return worker.fetch(new Request(`http://localhost${path}`, { method, headers: { "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { DB: database, ADMIN_TOKEN: token }, { waitUntil() {}, passThroughOnException() {} });
}
async function fixture(context) {
  const directory = await mkdtemp(join(tmpdir(), "zhihe-sqlite-test-"));
  let database = openDatabase(join(directory, "test.sqlite"));
  context.after(async () => { database.close(); await rm(directory, { recursive: true, force: true }); });
  return { get database() { return database; }, reopen() { database.close(); database = openDatabase(join(directory, "test.sqlite")); }, directory };
}

test("real SQLite survives reopen, deduplicates and only original receipt can withdraw", async (context) => {
  const f = await fixture(context);
  const first = await api(f.database, "/api/interest", "POST", valid);
  assert.equal(first.status, 200);
  const { withdrawalToken } = await first.json();
  const row = f.database.sqlite.prepare("SELECT * FROM purchase_intents").get();
  assert.notEqual(row.withdrawal_hash, withdrawalToken);
  assert.match(row.withdrawal_hash, /^[a-f0-9]{64}$/);
  f.reopen();
  assert.equal(f.database.sqlite.prepare("SELECT count(*) AS count FROM purchase_intents").get().count, 1);
  const duplicate = await (await api(f.database, "/api/interest", "POST", { ...valid, email: "BUYER@example.com" })).json();
  assert.deepEqual(Object.keys(duplicate).sort(), ["ok", "withdrawalToken"]);
  assert.notEqual(duplicate.withdrawalToken, withdrawalToken);
  await api(f.database, "/api/interest", "DELETE", { token: duplicate.withdrawalToken });
  assert.equal(f.database.sqlite.prepare("SELECT count(*) AS count FROM purchase_intents").get().count, 1);
  assert.equal((await api(f.database, "/api/interest", "DELETE", { token: withdrawalToken })).status, 200);
  assert.equal((await api(f.database, "/api/interest", "DELETE", { token: withdrawalToken })).status, 200);
  assert.equal(f.database.sqlite.prepare("SELECT count(*) AS count FROM purchase_intents").get().count, 0);
});

test("old schema upgrades preserving earlier interest", async (context) => {
  const f = await fixture(context);
  f.database.sqlite.exec("CREATE TABLE purchase_intents(id TEXT PRIMARY KEY,email TEXT NOT NULL,offer_id TEXT NOT NULL,source TEXT NOT NULL,consent_version TEXT NOT NULL,created_at TEXT NOT NULL)");
  f.database.sqlite.prepare("INSERT INTO purchase_intents VALUES(?,?,?,?,?,?)").run("legacy", "old@example.com", valid.offerId, "direct", "2026-07-30", new Date().toISOString());
  const response = await api(f.database, "/api/admin/summary", "GET", undefined, auth);
  assert.equal(response.status, 200);
  const summary = await response.json();
  assert.equal(summary.total, 1);
  assert.equal(summary.interests[0].status, "new");
});

test("admin fails closed, rejects cross-origin and leaves responses uncacheable", async (context) => {
  const f = await fixture(context);
  assert.equal((await api(f.database, "/api/admin/summary", "GET", undefined, auth, "")).status, 503);
  assert.equal((await api(f.database, "/api/admin/summary")).status, 401);
  assert.equal((await api(f.database, "/api/admin/summary", "GET", undefined, {authorization:adminToken})).status, 401);
  const denied = await api(f.database, "/api/admin/export", "GET", undefined, { ...auth, origin: "https://attacker.example" });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get("cache-control"), "no-store");
  assert.equal((await api(f.database, "/api/interest", "POST", valid, { "sec-fetch-site": "cross-site" })).status, 403);
});

test("event API accepts only opted-in whitelist events and stores counts without identifiers", async (context) => {
  const f = await fixture(context);
  for (const body of [{ event: "visit", consent: false }, { event: "private_answer", consent: true }, { event: "visit", consent: true, email: "x@example.com" }]) {
    assert.equal((await api(f.database, "/api/events", "POST", body)).status, 400);
  }
  for (const event of ["visit", "lesson_start", "lesson_complete", "visit"]) assert.equal((await api(f.database, "/api/events", "POST", { event, consent: true })).status, 200);
  const columns = f.database.sqlite.prepare("PRAGMA table_info(funnel_counts)").all().map((row) => row.name);
  assert.deepEqual(columns, ["day", "event", "count"]);
  assert.equal(f.database.sqlite.prepare("SELECT count FROM funnel_counts WHERE event='visit'").get().count, 2);
});

test("operator status, CSV formula protection and explicit expired-record purge work", async (context) => {
  const f = await fixture(context);
  await api(f.database, "/api/interest", "POST", { ...valid, email: "=formula@example.com" });
  const summaryResponse = await api(f.database, "/api/admin/summary", "GET", undefined, auth);
  const summary = await summaryResponse.json();
  const id = summary.interests[0].id;
  assert.equal((await api(f.database, "/api/admin/interest", "PATCH", { id, status: "contacted" }, auth)).status, 200);
  assert.equal(f.database.sqlite.prepare("SELECT status FROM purchase_intents").get().status, "contacted");
  assert.equal((await api(f.database, "/api/admin/interest", "PATCH", { id, status: "invented" }, auth)).status, 400);
  const exported = await api(f.database, "/api/admin/export", "GET", undefined, auth);
  assert.match(await exported.text(), /"'=formula@example.com"/);
  assert.equal(exported.headers.get("cache-control"), "no-store");
  f.database.sqlite.prepare("UPDATE purchase_intents SET created_at=? WHERE id=?").run("2020-01-01T00:00:00.000Z", id);
  await api(f.database, "/api/interest", "POST", valid);
  assert.equal((await api(f.database, "/api/admin/purge", "POST", {}, auth)).status, 200);
  assert.equal(f.database.sqlite.prepare("SELECT count(*) AS count FROM purchase_intents").get().count, 1);
});

test("oversized streamed body, bad JSON and missing database fail without successful receipt", async () => {
  assert.equal((await api(undefined, "/api/interest", "POST", valid)).status, 503);
  assert.equal((await api(undefined, "/api/interest", "POST", { ...valid, email: "x".repeat(3000) })).status, 413);
  const response = await worker.fetch(new Request("http://localhost/api/interest", { method: "POST", headers: { "content-type": "application/json" }, body: "{" }), {}, {});
  assert.equal(response.status, 400);
});

test("admin deletion removes only the selected legacy or current record", async (context) => {
  const f = await fixture(context);
  await api(f.database, "/api/interest", "POST", valid);
  await api(f.database, "/api/interest", "POST", { ...valid, email: "second@example.com" });
  const id = f.database.sqlite.prepare("SELECT id FROM purchase_intents WHERE email=?").get(valid.email).id;
  assert.equal((await api(f.database, "/api/admin/interest", "DELETE", { id })).status, 401);
  assert.equal((await api(f.database, "/api/admin/interest", "DELETE", { id }, auth)).status, 200);
  assert.equal(f.database.sqlite.prepare("SELECT count(*) AS count FROM purchase_intents").get().count, 1);
  assert.equal(f.database.sqlite.prepare("SELECT email FROM purchase_intents").get().email, "second@example.com");
});
