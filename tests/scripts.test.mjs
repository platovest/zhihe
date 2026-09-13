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

test("SQLite snapshot backs up and restores actual data and refuses overwrite", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "zhihe-backup-test-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const source = join(directory, "source.sqlite");
  const snapshot = join(directory, "backup.sqlite");
  const restored = join(directory, "restored.sqlite");
  const database = openDatabase(source);
  database.sqlite.exec("CREATE TABLE proof(value TEXT); INSERT INTO proof VALUES ('restored test data');");
  database.close();
  const script = fileURLToPath(new URL("../scripts/sqlite-snapshot.mjs", import.meta.url));
  execFileSync(process.execPath, [script, source, snapshot]);
  execFileSync(process.execPath, [script, snapshot, restored]);
  const check = openDatabase(restored);
  assert.equal(check.sqlite.prepare("SELECT value FROM proof").get().value, "restored test data");
  check.close();
  assert.notEqual(spawnSync(process.execPath, [script, source, snapshot]).status, 0);
  assert.equal((await stat(snapshot)).mode & 0o777, 0o600);
});
