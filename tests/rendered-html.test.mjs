import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { openDatabase } from "./sqlite-database.mjs";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function fetchWorker(path = "/", init, database) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      DB: database,
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete conversion page", async () => {
  const response = await fetchWorker("/", {
    headers: { accept: "text/html" },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>知合 ZHIHE｜把亲密，讲清楚<\/title>/i);
  assert.match(html, /不用猜/);
  assert.match(html, /开始免费完整课/);
  assert.match(html, /第 2–7 课付费/);
  assert.match(html, /价格与币种待公布/);
  assert.doesNotMatch(html, /演练|模拟|当前免费内测/);
  assert.match(html, /现在不会扣款/);
  assert.match(html, /不记录练习答案/);
  assert.match(html, /仅面向 18 岁以上成年人/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
  assert.doesNotMatch(html, /Codex/);
});

test("removes starter artifacts and keeps the offer contract explicit", async () => {
  const [page, layout, packageJson, client] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/ZhiheExperience.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ZhiheExperience/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(client, /不会扣款/);
  assert.match(client, /OFFER_ID/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("SkeletonPreview.tsx", previewRoot)));
  await assert.rejects(access(new URL("preview.css", previewRoot)));
  await assert.doesNotReject(access(templateRoot));
});

test("persists a valid purchase intent without exposing its record", async (context) => {
  const database = openDatabase(":memory:");
  context.after(() => database.close());
  const response = await fetchWorker(
    "/api/interest",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost",
      },
      body: JSON.stringify({
        email: "buyer@example.com",
        offerId: "overseas-launch-v2",
        source: "research",
        consent: true,
        website: "",
      }),
    },
    database,
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.match(body.withdrawalToken, /^[a-f0-9]{64}$/);
  assert.equal(database.sqlite.prepare("SELECT email FROM purchase_intents").get().email, "buyer@example.com");
});

test("rejects malformed interest before touching the database", async () => {
  const database = { prepare() { assert.fail("invalid input must not access SQL"); } };
  const response = await fetchWorker(
    "/api/interest",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        offerId: "overseas-launch-v2",
        source: "direct",
        consent: true,
        website: "",
      }),
    },
    database,
  );

  assert.equal(response.status, 400);
});
