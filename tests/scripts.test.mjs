import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { openDatabase } from "./sqlite-database.mjs";

test("admin initialization emits no secret, uses a real newline and never replaces an existing secret", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "zhihe-admin-init-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "scripts"));
  const script = join(directory, "scripts", "init-admin.mjs");
  await copyFile(new URL("../scripts/init-admin.mjs", import.meta.url), script);
  const output = execFileSync(process.execPath, [script], { encoding: "utf8" });
  const content = await readFile(join(directory, ".dev.vars"), "utf8");
  assert.match(content, /^ADMIN_TOKEN=[a-f0-9]{64}\n$/);
  assert.ok(!output.includes(content.trim().split("=")[1]));
  assert.equal((await stat(join(directory, ".dev.vars"))).mode & 0o777, 0o600);
  execFileSync(process.execPath, [script]);
  assert.equal(await readFile(join(directory, ".dev.vars"), "utf8"), content);
});

test("SQLite snapshot restores real interest, order and entitlement data and refuses overwrite", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "zhihe-backup-test-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const source = join(directory, "source.sqlite");
  const snapshot = join(directory, "backup.sqlite");
  const restored = join(directory, "restored.sqlite");
  const database = openDatabase(source);
  const { default: worker } = await import("../dist/server/index.js");
  const api = (db, path, body, cookie) => worker.fetch(new Request(`http://localhost${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }), { DB: db, ENABLE_COMMERCE_SIMULATION: "true" }, { waitUntil() {}, passThroughOnException() {} });
  const interest = await api(database, "/api/interest", { email: "restore@example.com", offerId: "overseas-launch-v2", source: "direct", consent: true, website: "" });
  assert.equal(interest.status, 200);
  const created = await api(database, "/api/commerce/orders", { consent: true, idempotencyKey: crypto.randomUUID() });
  assert.equal(created.status, 200);
  const cookie = created.headers.get("set-cookie").split(";")[0];
  const { order } = await created.json();
  assert.equal((await api(database, `/api/commerce/orders/${order.id}/pay`, { outcome: "success" }, cookie)).status, 200);
  database.close();
  const script = fileURLToPath(new URL("../scripts/sqlite-snapshot.mjs", import.meta.url));
  execFileSync(process.execPath, [script, source, snapshot]);
  execFileSync(process.execPath, [script, snapshot, restored]);
  const check = openDatabase(restored);
  assert.equal(check.sqlite.prepare("SELECT email FROM purchase_intents").get().email, "restore@example.com");
  const restoredAccount = await (await api(check, "/api/commerce/me", undefined, cookie)).json();
  assert.equal(restoredAccount.access, true);
  assert.equal(restoredAccount.orders[0].id, order.id);
  assert.equal(restoredAccount.orders[0].status, "simulated_paid");
  assert.equal((await api(check, "/api/lessons/boundaries", undefined, cookie)).status, 200);
  assert.equal((await api(check, "/api/lessons/boundaries")).status, 403);
  check.close();
  assert.notEqual(spawnSync(process.execPath, [script, source, snapshot]).status, 0);
  assert.equal((await stat(snapshot)).mode & 0o777, 0o600);
});
