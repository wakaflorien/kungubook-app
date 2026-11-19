/** Test-only driver on Node's built-in SQLite, so repository and sync tests run the real SQL. */
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { SqlDriver, SqlValue } from './driver';

export function nodeDriver(path = ':memory:'): SqlDriver {
  const db = new DatabaseSync(path);
  const args = (params?: readonly SqlValue[]) => (params ?? []) as SQLInputValue[];
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    all: async <T>(sql: string, params?: readonly SqlValue[]) => db.prepare(sql).all(...args(params)) as T[],
    get: async <T>(sql: string, params?: readonly SqlValue[]) =>
      (db.prepare(sql).get(...args(params)) as T | undefined) ?? null,
    run: async (sql, params) => {
      db.prepare(sql).run(...args(params));
    },
  };
}
