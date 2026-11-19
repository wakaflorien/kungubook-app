import { addEffects, type BalanceEffect } from '../lib/ledger';
import { migrate, type SqlDriver, type SqlValue } from './driver';

/** Tables that sync (names match `SyncTable` in the API spec). */
export type SyncTable = 'accounts' | 'categories' | 'transactions';
export const SYNC_TABLES: readonly SyncTable[] = ['accounts', 'categories', 'transactions'];

/** Every synced row carries these (RowMeta in the spec), plus its own fields. */
export interface StoredRow {
  id: string;
  version?: number;
  updated_at?: string;
  deleted_at?: string | null;
  client_updated_at?: string;
  [field: string]: unknown;
}

export type OutboxState = 'pending' | 'sending' | 'applied' | 'rejected';

export interface OutboxEntry {
  seq: number;
  tbl: SyncTable;
  row_id: string;
  op: 'upsert' | 'delete';
  row: StoredRow;
  effect: BalanceEffect;
  is_new: boolean;
  state: OutboxState;
  error: string | null;
}

interface OutboxRecord {
  seq: number;
  tbl: SyncTable;
  row_id: string;
  op: 'upsert' | 'delete';
  row: string;
  effect: string;
  is_new: number;
  state: OutboxState;
  error: string | null;
}

const toEntry = (r: OutboxRecord): OutboxEntry => ({
  ...r,
  row: JSON.parse(r.row) as StoredRow,
  effect: JSON.parse(r.effect) as BalanceEffect,
  is_new: !!r.is_new,
});

/** The indexed columns stored next to each row's JSON. */
function columns(table: SyncTable, row: StoredRow): Record<string, SqlValue> {
  const deleted_at = row.deleted_at ?? null;
  switch (table) {
    case 'accounts':
      return { sort_order: Number(row.sort_order ?? 0), deleted_at };
    case 'categories':
      return {
        direction: String(row.direction ?? 'out'),
        name: String(row.name ?? '').toLowerCase(),
        sort_order: Number(row.sort_order ?? 0),
        deleted_at,
      };
    case 'transactions':
      return {
        account_id: String(row.account_id),
        kind: String(row.kind),
        status: String(row.status ?? 'confirmed'),
        source: String(row.source ?? 'manual'),
        category_id: (row.category_id as string | null | undefined) ?? null,
        occurred_at: String(row.occurred_at),
        transfer_group_id: (row.transfer_group_id as string | null | undefined) ?? null,
        split_parent_id: (row.split_parent_id as string | null | undefined) ?? null,
        // Text the Activity search looks in (category names are matched through a join).
        search: [row.counterparty_text, row.note, row.reference, row.amount]
          .filter((v) => v !== undefined && v !== null && v !== '')
          .join(' ')
          .toLowerCase(),
        deleted_at,
      };
  }
}

export interface LocalStoreOptions {
  now?: () => Date;
}

/**
 * The local database: synced rows, the outbox of local changes, and sync metadata.
 * Writes are serialized through one lock and wrapped in a transaction; listeners hear about every write.
 */
export function createLocalStore(driver: SqlDriver, options: LocalStoreOptions = {}) {
  const now = () => (options.now ?? (() => new Date()))().toISOString();
  const listeners = new Set<() => void>();
  let queue: Promise<unknown> = Promise.resolve();
  let ready: Promise<void> | null = null;

  const init = () => (ready ??= migrate(driver));

  /** Runs `fn` alone, inside one SQLite transaction, then tells listeners (unless `notify` is false). */
  function write<T>(fn: () => Promise<T>, notify: boolean | ((result: T) => boolean) = true): Promise<T> {
    const run = async () => {
      await init();
      await driver.exec('BEGIN');
      try {
        const result = await fn();
        await driver.exec('COMMIT');
        return result;
      } catch (e) {
        await driver.exec('ROLLBACK');
        throw e;
      }
    };
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next.then((r) => {
      if (typeof notify === 'function' ? notify(r) : notify) listeners.forEach((l) => l());
      return r;
    });
  }

  async function read<T>(sql: string, params?: readonly SqlValue[]) {
    await init();
    return driver.all<T>(sql, params);
  }

  async function getRow<T extends StoredRow>(table: SyncTable, id: string): Promise<T | null> {
    await init();
    const r = await driver.get<{ json: string }>(`SELECT json FROM ${table} WHERE id = ?`, [id]);
    return r ? (JSON.parse(r.json) as T) : null;
  }

  async function putRow(table: SyncTable, row: StoredRow) {
    const cols = columns(table, row);
    const names = ['id', 'json', ...Object.keys(cols)];
    await driver.run(
      `INSERT OR REPLACE INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`,
      [row.id, JSON.stringify(row), ...Object.values(cols)],
    );
  }

  async function deleteRow(table: SyncTable, id: string) {
    await driver.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
  }

  /**
   * Records a local change for the next push. Must run inside `write`.
   * Changes to a row that hasn't been sent yet merge into one entry; a delete of a row the server never saw
   * cancels the whole thing.
   */
  async function enqueue(
    table: SyncTable,
    op: 'upsert' | 'delete',
    row: StoredRow,
    effect: BalanceEffect = {},
    isNew = false,
  ) {
    const open = (
      await driver.all<OutboxRecord>(
        `SELECT * FROM outbox WHERE tbl = ? AND row_id = ? AND state IN ('pending', 'rejected') ORDER BY seq`,
        [table, row.id],
      )
    ).map(toEntry);
    const inFlight = await driver.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM outbox WHERE tbl = ? AND row_id = ? AND state IN ('sending', 'applied')`,
      [table, row.id],
    );
    const neverSent = (open[0]?.is_new ?? isNew) && !inFlight?.n;
    const merged = addEffects(...open.map((e) => e.effect), effect);

    for (const e of open) await driver.run('DELETE FROM outbox WHERE seq = ?', [e.seq]);
    if (op === 'delete' && neverSent) {
      // Created and deleted before it ever synced: nothing to tell the server.
      await deleteRow(table, row.id);
      return;
    }
    await driver.run(
      `INSERT INTO outbox (seq, tbl, row_id, op, row, effect, is_new, state, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      // Keep the first entry's position so rows are pushed in the order they were created.
      [open[0]?.seq ?? null, table, row.id, op, JSON.stringify(row), JSON.stringify(merged), neverSent ? 1 : 0, now()],
    );
  }

  return {
    driver,
    init,
    write,
    read,
    getRow,
    putRow,
    deleteRow,
    enqueue,
    now,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },

    async outbox(states: readonly OutboxState[], limit = 500): Promise<OutboxEntry[]> {
      await init();
      const rows = await driver.all<OutboxRecord>(
        `SELECT * FROM outbox WHERE state IN (${states.map(() => '?').join(', ')}) ORDER BY seq LIMIT ?`,
        [...states, limit],
      );
      return rows.map(toEntry);
    },

    /** Rows with a local change the server hasn't confirmed: pulls don't overwrite these. */
    async hasLocalChange(table: SyncTable, id: string) {
      const r = await driver.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM outbox WHERE tbl = ? AND row_id = ? AND state IN ('pending', 'sending', 'rejected')`,
        [table, id],
      );
      return !!r?.n;
    },

    /** Balance changes from local writes the latest pulled balances don't include yet. */
    async pendingEffects(): Promise<BalanceEffect> {
      const rows = await read<{ effect: string }>(`SELECT effect FROM outbox`);
      return addEffects(...rows.map((r) => JSON.parse(r.effect) as BalanceEffect));
    },

    async counts() {
      const rows = await read<{ state: OutboxState; n: number }>(
        `SELECT state, COUNT(*) AS n FROM outbox GROUP BY state`,
      );
      const by = Object.fromEntries(rows.map((r) => [r.state, r.n])) as Partial<Record<OutboxState, number>>;
      return { unsynced: (by.pending ?? 0) + (by.sending ?? 0), rejected: by.rejected ?? 0 };
    },

    async getMeta(key: string) {
      await init();
      return (await driver.get<{ value: string }>('SELECT value FROM meta WHERE key = ?', [key]))?.value ?? null;
    },
    async setMeta(key: string, value: string) {
      await driver.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
    },

    /** After the database file was deleted (sign-out): run the migrations again on next use. */
    reset() {
      ready = null;
      queue = Promise.resolve();
    },

    /** Forget every synced row and local change. */
    async clear() {
      await write(async () => {
        for (const t of [...SYNC_TABLES, 'outbox', 'meta', 'sync_conflicts']) await driver.run(`DELETE FROM ${t}`);
      });
    },
  };
}

export type LocalStore = ReturnType<typeof createLocalStore>;
