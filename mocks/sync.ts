/**
 * The mock server's side of offline sync (TRD §4): a change log with a cursor, `GET /sync/pull` and
 * `POST /sync/push` with last-write-wins. It plays the backend: it owns `version`, `updated_at`,
 * `amount_base`, `has_parts` and account balances (recomputed with the shared ledger rules).
 */
import type { Account, Transaction, components } from '../src/api';
import { effectOfChange } from '../src/lib/ledger';

type Category = components['schemas']['Category'];
export type SyncTable = components['schemas']['SyncTable'];
type Row = { id: string; version: number; updated_at: string; deleted_at?: string | null; [k: string]: unknown };

/** What the handlers' user record needs to hold for sync. */
export interface SyncedUser {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}

/** Server-wide change log: every write gets the next number; a cursor is the last number a client saw. */
export interface ChangeLog {
  seq: number;
  rowSeq: Map<string, number>;
  /** `client_updated_at` of the write that produced each row, for last-write-wins. */
  clientTime: Map<string, string>;
}

export const createChangeLog = (): ChangeLog => ({ seq: 0, rowSeq: new Map(), clientTime: new Map() });

export function touch(log: ChangeLog, id: string) {
  log.seq += 1;
  log.rowSeq.set(id, log.seq);
}

/** Fields only the server sets. Anything else in a pushed row is writable. */
const SERVER_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
  'version',
  'client_updated_at',
  'balance',
  'balance_base',
  'last_reported_balance',
  'pending_count',
  'amount_base',
  'has_parts',
  'is_system',
  'attachment_count',
]);

const writable = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([k, v]) => !SERVER_FIELDS.has(k) && v !== undefined));

function tableOf(u: SyncedUser, table: SyncTable): Row[] | null {
  if (table === 'accounts') return u.accounts as unknown as Row[];
  if (table === 'categories') return u.categories as unknown as Row[];
  if (table === 'transactions') return u.transactions as unknown as Row[];
  return null; // Tables of later milestones.
}

export function pull(log: ChangeLog, u: SyncedUser, since: number, limit: number) {
  const rows: { table: SyncTable; row: Row; seq: number }[] = [];
  for (const table of ['accounts', 'categories', 'transactions'] as const) {
    for (const row of tableOf(u, table)!) {
      const seq = log.rowSeq.get(row.id) ?? 0;
      if (seq > since) rows.push({ table, row, seq });
    }
  }
  rows.sort((a, b) => a.seq - b.seq);
  const page = rows.slice(0, limit);
  const changes: Partial<Record<SyncTable, Row[]>> = {};
  for (const { table, row } of page) (changes[table] ??= []).push(structuredClone(row));
  const last = page[page.length - 1]?.seq ?? Math.max(since, 0);
  return { changes, cursor: String(last), has_more: rows.length > limit };
}

type Change = {
  table: SyncTable;
  op: 'upsert' | 'delete';
  row: { id: string; version?: number; client_updated_at: string } & Record<string, unknown>;
};
type Rejected = { id: string; error: 'validation_failed' | 'not_found'; message: string };

const now = () => new Date().toISOString();

export function push(log: ChangeLog, u: SyncedUser, changes: Change[]) {
  const applied: string[] = [];
  const conflicts: { id: string; server_row: Row }[] = [];
  const rejected: Rejected[] = [];

  /** Applies a transaction change to the accounts' balances, as the backend would. */
  const rebalance = (before: Transaction | null, after: Transaction | null) => {
    const effect = effectOfChange(before as never, after as never);
    for (const [accountId, delta] of Object.entries(effect)) {
      const a = (u.accounts as unknown as Row[]).find((x) => x.id === accountId);
      if (!a) continue;
      // The mock has no FX rates: other currencies count 1:1 in the base currency.
      Object.assign(a, {
        balance: Number(a.balance) + delta,
        balance_base: Number(a.balance_base) + delta,
        version: a.version + 1,
        updated_at: now(),
      });
      touch(log, accountId);
    }
  };

  const refreshParent = (parentId: string | null | undefined) => {
    if (!parentId) return;
    const parent = (u.transactions as unknown as Row[]).find((t) => t.id === parentId);
    if (!parent) return;
    const hasParts = u.transactions.some((t) => t.split_parent_id === parentId && !t.deleted_at);
    if (parent.has_parts !== hasParts) {
      Object.assign(parent, { has_parts: hasParts, version: parent.version + 1, updated_at: now() });
      touch(log, parentId);
    }
  };

  for (const change of changes) {
    const { table, op, row } = change;
    const rows = tableOf(u, table);
    if (!rows || !row?.id || !row.client_updated_at) {
      rejected.push({ id: row?.id ?? '', error: 'validation_failed', message: 'Unknown table or missing id' });
      continue;
    }
    const existing = rows.find((r) => r.id === row.id);

    // Last write wins: a stale version only applies when its edit is newer than the server's.
    if (existing && row.version !== existing.version) {
      const serverTime = log.clientTime.get(row.id) ?? existing.updated_at;
      if (serverTime > row.client_updated_at) {
        conflicts.push({ id: row.id, server_row: structuredClone(existing) });
        continue;
      }
    }

    const before = existing ? (structuredClone(existing) as Row) : null;
    const time = now();

    if (op === 'delete') {
      const softDelete = (r: Row) => {
        if (r.deleted_at) return;
        const prior = structuredClone(r);
        Object.assign(r, { deleted_at: time, updated_at: time, version: r.version + 1 });
        touch(log, r.id);
        if (table === 'transactions') {
          rebalance(prior as never, r as never);
          refreshParent(r.split_parent_id as string | null);
        }
      };
      if (existing && !existing.deleted_at) {
        softDelete(existing);
        if (table === 'transactions') {
          // Doc 05 §4: deleting one leg of a transfer deletes both; deleting a split parent deletes its parts.
          const group = existing.transfer_group_id;
          for (const r of rows) {
            if ((group && r.transfer_group_id === group) || r.split_parent_id === existing.id) softDelete(r);
          }
        }
      }
      log.clientTime.set(row.id, row.client_updated_at);
      applied.push(row.id);
      continue;
    }

    const fields = writable(row);
    if (table === 'transactions') {
      const t = { ...(existing ?? {}), ...fields } as Transaction;
      const account = u.accounts.find((a) => a.id === t.account_id && !a.deleted_at);
      if (!account) {
        rejected.push({ id: row.id, error: 'validation_failed', message: 'account_id: no such account' });
        continue;
      }
      if (!Number.isInteger(t.amount) || (t.amount ?? 0) < 1 || (t.kind !== 'in' && t.kind !== 'out')) {
        rejected.push({ id: row.id, error: 'validation_failed', message: 'amount must be greater than 0' });
        continue;
      }
    }
    if (table === 'accounts' && !existing && (!fields.name || !fields.type || !fields.currency)) {
      rejected.push({ id: row.id, error: 'validation_failed', message: 'id, type, name and currency are required' });
      continue;
    }

    if (existing) {
      Object.assign(existing, fields, { deleted_at: null, updated_at: time, version: existing.version + 1 });
    } else {
      const created: Row = { ...fields, id: row.id, created_at: time, updated_at: time, deleted_at: null, version: 1 };
      if (table === 'accounts') {
        const opening = Number(fields.opening_balance ?? 0);
        Object.assign(created, {
          include_in_total: true,
          archived: false,
          ...created,
          opening_balance: opening,
          balance: opening,
          balance_base: opening,
          last_reported_balance: null,
          pending_count: 0,
        });
      }
      if (table === 'categories') Object.assign(created, { is_system: false });
      if (table === 'transactions') {
        const acct = u.accounts.find((a) => a.id === fields.account_id)!;
        Object.assign(created, {
          currency: acct.currency,
          fee: 0,
          status: 'confirmed',
          source: 'manual',
          transfer_group_id: null,
          split_parent_id: null,
          has_parts: false,
          ...created,
        });
      }
      rows.push(created);
    }
    const after = rows.find((r) => r.id === row.id)!;
    touch(log, row.id);
    log.clientTime.set(row.id, row.client_updated_at);

    if (table === 'accounts' && before) {
      const delta = Number(after.opening_balance ?? 0) - Number(before.opening_balance ?? 0);
      if (delta)
        Object.assign(after, {
          balance: Number(after.balance) + delta,
          balance_base: Number(after.balance_base) + delta,
        });
    }
    if (table === 'transactions') {
      after.amount_base = after.amount;
      rebalance(before as never, after as never);
      refreshParent(after.split_parent_id as string | null);
    }
    applied.push(row.id);
  }
  return { applied, conflicts, rejected };
}
