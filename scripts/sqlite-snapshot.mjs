import { DatabaseSync, backup } from "node:sqlite";
import { open, chmod } from "node:fs/promises";
import { resolve } from "node:path";

// Explicit file paths only. Restore uses the same verified snapshot operation
// into a NEW destination, so it cannot replace a running or existing database.
const [sourceArgument, destinationArgument] = process.argv.slice(2);
if (!sourceArgument || !destinationArgument) throw new Error("用法：node scripts/sqlite-snapshot.mjs 源.sqlite 新目标.sqlite；目标必须不存在。");
const source = resolve(sourceArgument);
const destination = resolve(destinationArgument);
if (source === destination) throw new Error("源文件与目标文件不能相同。");
const database = new DatabaseSync(source, { readOnly: true });
try {
  const check = database.prepare("PRAGMA integrity_check").get();
  if (check.integrity_check !== "ok") throw new Error("源数据库完整性检查失败。");
  const target = await open(destination, "wx", 0o600);
  await target.close();
  await backup(database, destination);
  await chmod(destination, 0o600);
  const copied = new DatabaseSync(destination, { readOnly: true });
  try {
    if (copied.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("备份完整性检查失败。");
  } finally { copied.close(); }
  console.log(`已生成并校验 SQLite 快照：${destination}`);
} finally { database.close(); }
