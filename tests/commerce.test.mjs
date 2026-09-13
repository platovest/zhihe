import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "./sqlite-database.mjs";

const { default: worker } = await import("../dist/server/index.js");
const adminToken = "test-only-local-commerce-admin-at-least-32-characters";
const auth = { authorization: `Bearer ${adminToken}` };
const ctx = { waitUntil() {}, passThroughOnException() {} };
function api(database, path, { method = "GET", body, cookie, headers = {}, host = "localhost", token = adminToken } = {}) {
  return worker.fetch(new Request(`http://${host}${path}`, {
    method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), { DB: database, ADMIN_TOKEN: token }, ctx);
}
async function fixture(context) {
  const directory = await mkdtemp(join(tmpdir(), "zhihe-commerce-test-"));
  let database = openDatabase(join(directory, "test.sqlite"));
  context.after(async () => { database.close(); await rm(directory, { recursive: true, force: true }); });
  return { get database() { return database; }, reopen() { database.close(); database = openDatabase(join(directory, "test.sqlite")); } };
}
async function create(database, cookie, key = randomUUID()) {
  const response = await api(database, "/api/commerce/orders", { method: "POST", body: { consent: true, idempotencyKey: key }, cookie });
  assert.equal(response.status, 200);
  const value = await response.json();
  return { ...value, cookie: response.headers.get("set-cookie")?.split(";")[0], rawCookie: response.headers.get("set-cookie"), key };
}
async function action(database, order, operation, body = {}, headers = {}) {
  return api(database, `/api/commerce/orders/${order.order.id}/${operation}`, { method: "POST", cookie: order.cookie, body, headers });
}

test("GET me does not create a session; orders persist on disk and deduplicate after reopen", async (context) => {
  const f = await fixture(context);
  const empty = await api(f.database, "/api/commerce/me");
  assert.deepEqual(await empty.json(), { ok: true, mode: "local_simulation", orders: [], access: false });
  assert.equal(empty.headers.get("set-cookie"), null);
  const order = await create(f.database);
  assert.equal(order.mode, "local_simulation");
  assert.match(order.rawCookie, /HttpOnly/);
  assert.match(order.rawCookie, /SameSite=Strict/);
  assert.match(order.rawCookie, /Path=\//);
  assert.equal(order.order.amount, 19900);
  assert.equal(order.order.currency, "CNY");
  assert.equal(order.order.status, "pending");
  const stored = f.database.sqlite.prepare("SELECT session_hash FROM simulation_orders").get().session_hash;
  assert.notEqual(stored, order.cookie.split("=")[1]);
  assert.match(stored, /^[a-f0-9]{64}$/);
  f.reopen();
  const repeat = await create(f.database, order.cookie, order.key);
  assert.equal(repeat.order.id, order.order.id);
  const duplicates = await Promise.all([create(f.database, order.cookie, order.key), create(f.database, order.cookie, order.key)]);
  assert.ok(duplicates.every((item) => item.order.id === order.order.id));
  assert.equal(f.database.sqlite.prepare("SELECT count(*) AS count FROM simulation_orders").get().count, 1);
  const stolenKey = await api(f.database, "/api/commerce/orders", { method: "POST", body: { consent: true, idempotencyKey: order.key } });
  assert.equal(stolenKey.status, 409);
  assert.equal(f.database.sqlite.prepare("SELECT count(*) AS count FROM simulation_orders").get().count, 1);
});

test("catalog metadata is public locally but all six lesson bodies require active access", async (context) => {
  const f = await fixture(context);
  const response = await api(f.database, "/api/catalog");
  assert.equal(response.status, 200);
  const { lessons } = await response.json();
  assert.equal(lessons.length, 7);
  assert.ok(lessons.every((lesson) => !("quiz" in lesson) && !("card" in lesson) && !("learn" in lesson)));
  for (const lesson of lessons) {
    const response = await api(f.database, `/api/lessons/${lesson.slug}`);
    assert.equal(response.status, lesson.slug === "expression" ? 200 : 403);
    if (lesson.slug !== "expression") assert.equal((await response.json()).error, "access_required");
  }
  assert.equal((await api(f.database, "/api/lessons/not-a-lesson")).status, 404);
  const order = await create(f.database);
  const failed = await action(f.database, order, "pay", { outcome: "failure" });
  assert.equal(failed.status, 402);
  const failure = await failed.json();
  assert.equal(failure.error, "simulated_decline");
  assert.equal(failure.order.status, "pending");
  assert.equal(failure.access, false);
  const protectedLesson = lessons.find((lesson) => lesson.slug !== "expression");
  assert.equal((await api(f.database, `/api/lessons/${protectedLesson.slug}`, { cookie: order.cookie })).status, 403);
  assert.equal((await action(f.database, order, "pay", { outcome: "success" })).status, 200);
  assert.equal((await action(f.database, order, "pay", { outcome: "success" })).status, 200);
  for (const lesson of lessons) assert.equal((await api(f.database, `/api/lessons/${lesson.slug}`, { cookie: order.cookie })).status, 200);
});

test("refund request retains access; administrator completion revokes it atomically and is idempotent", async (context) => {
  const f = await fixture(context);
  const order = await create(f.database);
  await action(f.database, order, "pay", { outcome: "success" });
  const requested = await (await action(f.database, order, "refund")).json();
  assert.equal(requested.order.status, "refund_requested");
  assert.equal(requested.access, true);
  assert.equal((await action(f.database, order, "refund")).status, 200);
  const adminPath = `/api/admin/commerce/${order.order.id}/refund`;
  assert.equal((await api(f.database, adminPath, { method: "POST", body: {} })).status, 401);
  const completed = await api(f.database, adminPath, { method: "POST", body: {}, headers: auth });
  assert.equal((await completed.json()).order.status, "simulated_refunded");
  assert.equal((await api(f.database, adminPath, { method: "POST", body: {}, headers: auth })).status, 200);
  f.reopen();
  const me = await (await api(f.database, "/api/commerce/me", { cookie: order.cookie })).json();
  assert.equal(me.access, false);
  const catalog = await (await api(f.database, "/api/catalog")).json();
  const lesson = catalog.lessons.find((lesson) => lesson.slug !== "expression");
  assert.equal((await api(f.database, `/api/lessons/${lesson.slug}`, { cookie: order.cookie })).status, 403);
  assert.equal((await action(f.database, order, "pay", { outcome: "success" })).status, 409);
});

test("another active order preserves access after one refund", async (context) => {
  const f = await fixture(context);
  const first = await create(f.database);
  const second = await create(f.database, first.cookie);
  await action(f.database, first, "pay", { outcome: "success" });
  await action(f.database, second, "pay", { outcome: "success" });
  await action(f.database, first, "refund");
  await api(f.database, `/api/admin/commerce/${first.order.id}/refund`, { method: "POST", body: {}, headers: auth });
  assert.equal((await (await api(f.database, "/api/commerce/me", { cookie: first.cookie })).json()).access, true);
});

test("pending cancellation is terminal; invalid state changes and client price overrides are rejected", async (context) => {
  const f = await fixture(context);
  const order = await create(f.database);
  assert.equal((await action(f.database, order, "refund")).status, 409);
  assert.equal((await api(f.database, `/api/admin/commerce/${order.order.id}/refund`, { method: "POST", body: {}, headers: auth })).status, 409);
  assert.equal((await api(f.database, `/api/admin/commerce/${order.order.id}/delete`, { method: "POST", body: {}, headers: auth })).status, 409);
  assert.equal((await action(f.database, order, "cancel")).status, 200);
  assert.equal((await action(f.database, order, "cancel")).status, 200);
  assert.equal((await action(f.database, order, "pay", { outcome: "success" })).status, 409);
  assert.equal((await action(f.database, order, "pay", { outcome: "failure" })).status, 409);
  assert.equal((await action(f.database, order, "refund")).status, 409);
  const override = await api(f.database, "/api/commerce/orders", { method: "POST", body: { consent: true, idempotencyKey: randomUUID(), amount: 1 } });
  assert.equal(override.status, 400);
  const paid = await create(f.database, order.cookie);
  await action(f.database, paid, "pay", { outcome: "success" });
  assert.equal((await action(f.database, paid, "cancel")).status, 409);
  assert.equal((await api(f.database, `/api/admin/commerce/${paid.order.id}/delete`, { method: "POST", body: {}, headers: auth })).status, 409);
});

test("cookie sessions cannot read or modify each other's orders; logout only expires cookie", async (context) => {
  const f = await fixture(context);
  const first = await create(f.database);
  const second = await create(f.database);
  const other = { ...first, cookie: second.cookie };
  assert.equal((await action(f.database, other, "pay", { outcome: "success" })).status, 404);
  assert.equal((await action(f.database, other, "cancel")).status, 404);
  assert.equal((await action(f.database, other, "refund")).status, 404);
  const me = await (await api(f.database, "/api/commerce/me", { cookie: second.cookie })).json();
  assert.equal(me.orders.length, 1);
  assert.equal(me.orders[0].id, second.order.id);
  const logout = await api(f.database, "/api/commerce/logout", { method: "POST", body: {}, cookie: first.cookie });
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(f.database.sqlite.prepare("SELECT count(*) AS count FROM simulation_orders").get().count, 2);
});

test("admin export lists no session secrets; deletion is restricted to ended orders", async (context) => {
  const f = await fixture(context);
  const order = await create(f.database);
  const response = await api(f.database, "/api/admin/commerce", { headers: auth });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const text = await response.text();
  assert.doesNotMatch(text, /session|hash|idempotency/i);
  await action(f.database, order, "cancel");
  assert.equal((await api(f.database, `/api/admin/commerce/${order.order.id}/delete`, { method: "POST", body: {}, headers: auth })).status, 200);
  assert.equal(f.database.sqlite.prepare("SELECT count(*) AS count FROM simulation_orders").get().count, 0);
});

test("nonlocal hosts, missing admin configuration, cross-origin, malformed and oversized bodies fail closed", async (context) => {
  const f = await fixture(context);
  const remote = await api(f.database, "/api/commerce/me", { host: "production.example" });
  assert.equal(remote.status, 403);
  assert.equal((await remote.json()).error, "local_only");
  assert.equal((await api(f.database, "/api/admin/commerce", { token: "", headers: auth })).status, 503);
  assert.equal((await api(f.database, "/api/admin/commerce", { headers: { authorization: adminToken } })).status, 401);
  assert.equal((await api(f.database, "/api/commerce/orders", { method: "POST", body: { consent: true, idempotencyKey: randomUUID() }, headers: { origin: "https://cross.example" } })).status, 403);
  assert.equal((await api(f.database, "/api/commerce/orders", { method: "POST", body: { consent: false, idempotencyKey: randomUUID() } })).status, 400);
  const oversized = await api(f.database, "/api/commerce/orders", { method: "POST", body: { consent: true, idempotencyKey: "a".repeat(3000) } });
  assert.equal(oversized.status, 413);
  assert.equal((await oversized.json()).mode, "local_simulation");
});

test("every order state enforces payment, cancellation and refund transition matrix", async (context) => {
  const f = await fixture(context);
  const order = await create(f.database);
  const states = ["pending", "cancelled", "simulated_paid", "refund_requested", "simulated_refunded"];
  const cases = [
    { action: "pay", body: { outcome: "success" }, statuses: [200, 409, 200, 409, 409], targets: ["simulated_paid", "cancelled", "simulated_paid", "refund_requested", "simulated_refunded"] },
    { action: "pay", body: { outcome: "failure" }, statuses: [402, 409, 409, 409, 409], targets: states },
    { action: "cancel", body: {}, statuses: [200, 200, 409, 409, 409], targets: ["cancelled", "cancelled", "simulated_paid", "refund_requested", "simulated_refunded"] },
    { action: "refund", body: {}, statuses: [409, 409, 200, 200, 409], targets: ["pending", "cancelled", "refund_requested", "refund_requested", "simulated_refunded"] },
    { action: "admin-refund", body: {}, statuses: [409, 409, 409, 200, 200], targets: ["pending", "cancelled", "simulated_paid", "simulated_refunded", "simulated_refunded"] },
  ];
  for (const [index, state] of states.entries()) {
    for (const entry of cases) {
      f.database.sqlite.prepare("UPDATE simulation_orders SET status=? WHERE id=?").run(state, order.order.id);
      const response = entry.action === "admin-refund"
        ? await api(f.database, `/api/admin/commerce/${order.order.id}/refund`, { method: "POST", body: {}, headers: auth })
        : await action(f.database, order, entry.action, entry.body);
      assert.equal(response.status, entry.statuses[index], `${state} -> ${entry.action}`);
      assert.equal(f.database.sqlite.prepare("SELECT status FROM simulation_orders WHERE id=?").get(order.order.id).status, entry.targets[index]);
    }
  }
});

test("racing pay and cancel allows exactly one transition and never revives cancellation", async (context) => {
  const f = await fixture(context);
  const order = await create(f.database);
  const responses = await Promise.all([action(f.database, order, "pay", { outcome: "success" }), action(f.database, order, "cancel")]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  const me = await (await api(f.database, "/api/commerce/me", { cookie: order.cookie })).json();
  assert.equal(me.access, me.orders[0].status === "simulated_paid");
});
