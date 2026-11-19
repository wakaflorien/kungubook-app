/** Values SQLite can bind. */
export type SqlValue = string | number | null;

/**
 * The few SQLite calls the repositories need. The app uses expo-sqlite (src/platform/db.ts);
 * tests use Node's built-in `node:sqlite` (src/db/testing.ts), so the same SQL runs in both.
 */
export interface SqlDriver {
  exec(sql: string): Promise<void>;
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  get<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  run(sql: string, params?: readonly SqlValue[]): Promise<void>;
}

/** Schema changes, applied in order and tracked with `PRAGMA user_version`. Never edit a shipped step. */
export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY NOT NULL,
    json TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    json TEXT NOT NULL,
    direction TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    json TEXT NOT NULL,
    account_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    category_id TEXT,
    occurred_at TEXT NOT NULL,
    transfer_group_id TEXT,
    split_parent_id TEXT,
    search TEXT NOT NULL DEFAULT '',
    deleted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS transactions_time ON transactions (occurred_at DESC);
  CREATE INDEX IF NOT EXISTS transactions_group ON transactions (transfer_group_id);
  CREATE INDEX IF NOT EXISTS transactions_parent ON transactions (split_parent_id);
  -- Local changes waiting for /sync/push. One pending entry per row; a row can also have entries in flight.
  CREATE TABLE IF NOT EXISTS outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    tbl TEXT NOT NULL,
    row_id TEXT NOT NULL,
    op TEXT NOT NULL,
    row TEXT NOT NULL,
    effect TEXT NOT NULL DEFAULT '{}',
    is_new INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS outbox_row ON outbox (tbl, row_id);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  -- The losing copy of a last-write-wins conflict, kept for debugging (TRD §4).
  CREATE TABLE IF NOT EXISTS sync_conflicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tbl TEXT NOT NULL,
    row_id TEXT NOT NULL,
    local TEXT NOT NULL,
    server TEXT NOT NULL,
    at TEXT NOT NULL
  );
  `,
];

export async function migrate(driver: SqlDriver) {
  const row = await driver.get<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await driver.exec(`BEGIN; ${MIGRATIONS[v]} PRAGMA user_version = ${v + 1}; COMMIT;`);
  }
}
