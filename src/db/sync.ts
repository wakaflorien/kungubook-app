import { ApiError, unwrap, type KunguBookClient } from '../api';
import { SYNC_TABLES, type LocalStore, type StoredRow, type SyncTable } from './store';

/** Read-only fields the server computes for accounts; taken from a pull even while a local edit is pending. */
const ACCOUNT_COMPUTED = ['balance', 'balance_base', 'last_reported_balance', 'pending_count'] as const;

const CURSOR = 'sync.cursor';
const LAST_SYNCED = 'sync.last_synced_at';
const BATCH = 500;

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncStatus {
  phase: SyncPhase;
  /** ISO time of the last successful sync, or null before the first one. */
  lastSyncedAt: string | null;
  /** Local changes not on the server yet. */
  unsynced: number;
  /** Changes the server refused (shown as "couldn't sync"). */
  rejected: number;
  error: ApiError | null;
}

export interface SyncEngineOptions {
  store: LocalStore;
  api: KunguBookClient;
  onStatus?: (s: SyncStatus) => void;
}

/**
 * Offline sync (TRD §4): push the outbox to `POST /sync/push` in batches, then pull everything changed since the
 * cursor from `GET /sync/pull`. Last write wins (by `client_updated_at`) on the server; the loser goes to
 * `sync_conflicts`. Only one run at a time; a request during a run schedules one more run after it.
 */
export function createSyncEngine({ store, api, onStatus }: SyncEngineOptions) {
  let status: SyncStatus = { phase: 'idle', lastSyncedAt: null, unsynced: 0, rejected: 0, error: null };
  let running: Promise<void> | null = null;
  let again = false;

  const emit = async (patch: Partial<SyncStatus>) => {
    status = { ...status, ...(await store.counts()), ...patch };
    onStatus?.(status);
  };

  async function push() {
    for (;;) {
      const batch = await store.outbox(['pending'], BATCH);
      if (!batch.length) return;
      const seqs = batch.map((e) => e.seq);
      await store.write(async () => {
        for (const s of seqs) await store.driver.run(`UPDATE outbox SET state = 'sending' WHERE seq = ?`, [s]);
      }, false);

      let result;
      try {
        result = await unwrap(
          api.POST('/sync/push', {
            body: { changes: batch.map((e) => ({ table: e.tbl, op: e.op, row: e.row as never })) },
          }),
        );
      } catch (e) {
        // Not sent (or no answer): try these again next time.
        await store.write(async () => {
          for (const s of seqs) {
            await store.driver.run(`UPDATE outbox SET state = 'pending' WHERE seq = ? AND state = 'sending'`, [s]);
          }
        }, false);
        throw e;
      }

      const byRow = new Map(batch.map((e) => [e.row_id, e]));
      await store.write(async () => {
        for (const id of result.applied) {
          const e = byRow.get(id);
          if (e) await store.driver.run(`UPDATE outbox SET state = 'applied' WHERE seq = ?`, [e.seq]);
        }
        for (const c of result.conflicts) {
          const e = byRow.get(c.id);
          if (!e) continue;
          // The server's copy is newer: keep it, and log ours.
          await store.driver.run('INSERT INTO sync_conflicts (tbl, row_id, local, server, at) VALUES (?, ?, ?, ?, ?)', [
            e.tbl,
            e.row_id,
            JSON.stringify(e.row),
            JSON.stringify(c.server_row),
            store.now(),
          ]);
          await store.driver.run('DELETE FROM outbox WHERE seq = ?', [e.seq]);
          await store.putRow(e.tbl, c.server_row as StoredRow);
        }
        for (const r of result.rejected) {
          const e = byRow.get(r.id);
          if (e) {
            await store.driver.run(`UPDATE outbox SET state = 'rejected', error = ? WHERE seq = ?`, [
              r.message ?? r.error,
              e.seq,
            ]);
          }
        }
      }, result.conflicts.length > 0);
    }
  }

  async function applyRow(table: SyncTable, row: StoredRow) {
    if (!(await store.hasLocalChange(table, row.id))) {
      await store.putRow(table, row);
      return;
    }
    // A local edit is waiting: keep it, but take the balances the server computed.
    if (table === 'accounts') {
      const local = await store.getRow(table, row.id);
      if (local) {
        for (const k of ACCOUNT_COMPUTED) if (k in row) local[k] = row[k];
        await store.putRow(table, local);
      }
    }
  }

  async function pull() {
    let cursor = await store.getMeta(CURSOR);
    for (;;) {
      const page = await unwrap(
        api.GET('/sync/pull', { params: { query: { ...(cursor ? { since: cursor } : {}), limit: BATCH } } }),
      );
      // Screens only re-read when something actually changed (pulls run every few seconds).
      await store.write(
        async () => {
          let changed = 0;
          for (const table of SYNC_TABLES) {
            for (const row of (page.changes[table] ?? []) as StoredRow[]) {
              await applyRow(table, row);
              changed += 1;
            }
          }
          await store.setMeta(CURSOR, page.cursor);
          if (!page.has_more) {
            // The pulled balances now include what was pushed, so those effects can go.
            const applied = await store.driver.get<{ n: number }>(
              `SELECT COUNT(*) AS n FROM outbox WHERE state = 'applied'`,
            );
            changed += applied?.n ?? 0;
            await store.driver.run(`DELETE FROM outbox WHERE state = 'applied'`);
            const first = !(await store.getMeta(LAST_SYNCED));
            await store.setMeta(LAST_SYNCED, store.now());
            if (first) changed += 1;
          }
          return changed;
        },
        (changed) => changed > 0,
      );
      cursor = page.cursor;
      if (!page.has_more) return;
    }
  }

  async function run() {
    await emit({ phase: 'syncing', lastSyncedAt: await store.getMeta(LAST_SYNCED) });
    try {
      await push();
      await pull();
      await emit({ phase: 'idle', error: null, lastSyncedAt: await store.getMeta(LAST_SYNCED) });
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError({ code: 'unknown', status: 0, message: String(e) });
      await emit({ phase: err.code === 'network' ? 'offline' : 'error', error: err });
      throw err;
    }
  }

  return {
    /** Runs a sync now (or right after the one in progress). Rejects when it fails; status says why. */
    sync(): Promise<void> {
      if (running) {
        again = true;
        return running;
      }
      running = (async () => {
        try {
          do {
            again = false;
            await run();
          } while (again);
        } finally {
          running = null;
        }
      })();
      return running;
    },
    get status() {
      return status;
    },
    async hasSynced() {
      return !!(await store.getMeta(LAST_SYNCED));
    },
    /** Puts rejected changes back in the queue (the Retry on the "couldn't sync" banner). */
    async retryRejected() {
      await store.write(() =>
        store.driver.run(`UPDATE outbox SET state = 'pending', error = NULL WHERE state = 'rejected'`),
      );
    },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
