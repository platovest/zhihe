import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../.dev.vars", import.meta.url));
try {
  await writeFile(path, `ADMIN_TOKEN=${randomBytes(32).toString("hex")}\n`, { flag: "wx", mode: 0o600 });
  console.log(`管理口令已保存到 ${path}；重启本地服务后生效。`);
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log(`${path} 已存在，保留原文件。`);
}
