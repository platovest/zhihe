import { DatabaseSync } from "node:sqlite";

// D1-shaped adapter over real SQLite. SQL statements execute on disk unchanged.
export function openDatabase(path) {
  const sqlite = new DatabaseSync(path);
  const database = {
    sqlite,
    prepare(sql) {
      let bindings = [];
      return {
        bind(...values) { bindings = values; return this; },
        async run() { return sqlite.prepare(sql).run(...bindings); },
        async all() { return { results: sqlite.prepare(sql).all(...bindings) }; },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try { const results = []; for (const item of statements) results.push(await item.run()); sqlite.exec("COMMIT"); return results; }
      catch (error) { sqlite.exec("ROLLBACK"); throw error; }
    },
    close() { sqlite.close(); },
  };
  return database;
}
