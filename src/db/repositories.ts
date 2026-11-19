import type { Account, components, Transaction } from '../api';
import { effectOfChange, splitProblem, startOfDay, totals, type BalanceEffect, type Totals } from '../lib/ledger';
import { newId } from '../lib/id';
import type { SqlValue } from './driver';
import type { LocalStore, StoredRow } from './store';

export type Category = components['schemas']['Category'];
export type TxnKind = components['schemas']['TxnKind'];
export type TxnSource = components['schemas']['TxnSource'];
export type TxnStatus = components['schemas']['TxnStatus'];
type AccountInput = components['schemas']['AccountInput'];

/**
 * A transaction as stored locally. The generated `Transaction` marks every field optional (how the spec
 * composes allOf); these are always present on a saved row.
 */
export type Txn = Transaction & {
  id: string;
  account_id: string;
  kind: TxnKind;
  amount: number;
  currency: string;
  amount_base: number;
  fee: number;
  occurred_at: string;
  status: TxnStatus;
  source: TxnSource;
};
/** An account as stored locally (`id` is always set). */
export type Acct = Account & { id: string };

/** Fields a person can set on an income or expense. */
export interface TransactionDraft {
  account_id: string;
  kind: TxnKind;
  amount: number;
  fee?: number;
  occurred_at: string;
  category_id?: string | null;
  counterparty_text?: string;
  note?: string;
  reference?: string;
  status?: TxnStatus;
}

export interface TransferDraft {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  /** Only when the accounts use different currencies. */
  received_amount?: number;
  fee?: number;
  occurred_at: string;
  note?: string;
}

export interface SplitPart {
  amount: number;
  category_id: string;
  note?: string;
}

/** Activity filters (screen 04). Empty lists mean "any". */
export interface TransactionFilter {
  /** Days, `YYYY-MM-DD`, in the user's time zone; `to` is exclusive. */
  from?: string;
  to?: string;
  directions?: readonly ('in' | 'out' | 'transfer')[];
  accountIds?: readonly string[];
  sources?: readonly TxnSource[];
  statuses?: readonly TxnStatus[];
  categoryId?: string;
  q?: string;
  limit?: number;
}

/** One Activity row: a transaction, or both legs of a transfer shown as one. */
export interface TransactionItem {
  txn: Txn;
  category: Category | null;
  account: Acct | null;
  /** Set for transfers: the two legs. */
  transfer: { out: Txn; in: Txn; from: Acct | null; to: Acct | null } | null;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

const parse = <T>(json: string) => JSON.parse(json) as T;
const live = <T extends { deleted_at?: string | null }>(r: T | null): r is T => !!r && !r.deleted_at;

export function createRepositories(store: LocalStore, opts: { timeZone?: () => string; baseCurrency?: () => string }) {
  const tz = () => opts.timeZone?.() ?? 'Africa/Kigali';
  const base = () => opts.baseCurrency?.() ?? 'RWF';

  // ------------------------------------------------------------------ accounts
  const accounts = {
    /** Accounts with their balance: the last synced balance plus local changes not synced yet. */
    async list(): Promise<Acct[]> {
      const [rows, pending] = await Promise.all([
        store.read<{ json: string }>('SELECT json FROM accounts WHERE deleted_at IS NULL ORDER BY sort_order, rowid'),
        store.pendingEffects(),
      ]);
      return rows
        .map((r) => parse<Acct>(r.json))
        .filter((a) => !a.archived)
        .map((a) => withPending(a, pending));
    },

    async get(id: string) {
      const a = await store.getRow<Acct & StoredRow>('accounts', id);
      return live(a) ? withPending(a, await store.pendingEffects()) : null;
    },

    /** The Home total: accounts included in the total, in the base currency. */
    async total() {
      const list = await accounts.list();
      return {
        amount: list.filter((a) => a.include_in_total !== false).reduce((s, a) => s + (a.balance_base ?? 0), 0),
        currency: base(),
      };
    },

    async create(input: AccountInput & { id?: string; name: string; type: Acct['type']; currency: string }) {
      const now = store.now();
      const id = input.id ?? newId();
      const opening = input.opening_balance ?? 0;
      const existing = await accounts.list();
      const row = {
        include_in_total: true,
        archived: false,
        sort_order: existing.length,
        opening_date: now.slice(0, 10),
        ...input,
        id,
        name: input.name.trim(),
        opening_balance: opening,
        // Until the server answers, the balance is the opening balance.
        balance: opening,
        balance_base: input.currency === base() ? opening : 0,
        last_reported_balance: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 0,
        client_updated_at: now,
      } as Acct & StoredRow;
      await store.write(async () => {
        await store.putRow('accounts', row);
        await store.enqueue('accounts', 'upsert', row, {}, true);
      });
      return row as Acct;
    },

    async update(id: string, patch: AccountInput) {
      return store.write(async () => {
        const current = await store.getRow<Acct & StoredRow>('accounts', id);
        if (!live(current)) throw new ValidationError('This account was deleted');
        const now = store.now();
        const next = { ...current, ...patch, id, updated_at: now, client_updated_at: now };
        const delta = (next.opening_balance ?? 0) - (current.opening_balance ?? 0);
        await store.putRow('accounts', next);
        await store.enqueue('accounts', 'upsert', next, delta ? { [id]: delta } : {});
        return next as Acct;
      });
    },
  };

  function withPending(a: Acct, pending: BalanceEffect): Acct {
    const d = pending[a.id ?? ''] ?? 0;
    if (!d) return a;
    // Other currencies get their base value from the server's rate once synced.
    return { ...a, balance: a.balance + d, balance_base: a.balance_base + (a.currency === base() ? d : 0) };
  }

  // ------------------------------------------------------------------ categories
  const categories = {
    async list(direction?: TxnKind): Promise<Category[]> {
      const rows = await store.read<{ json: string }>(
        `SELECT json FROM categories WHERE deleted_at IS NULL ${direction ? 'AND direction = ?' : ''}
         ORDER BY sort_order, name`,
        direction ? [direction] : [],
      );
      return rows.map((r) => parse<Category>(r.json));
    },
  };

  // ------------------------------------------------------------------ transactions
  async function accountOrThrow(id: string) {
    const a = await store.getRow<Acct & StoredRow>('accounts', id);
    if (!live(a)) throw new ValidationError('Choose an account', 'account_id');
    return a;
  }

  function checkAmount(amount: number, field = 'amount') {
    if (!Number.isInteger(amount) || amount < 1) throw new ValidationError('Enter an amount', field);
  }

  /** Writes a row and queues it, with the balance effect of the change. Must run inside `store.write`. */
  async function save(before: Txn | null, after: Txn, isNew = false) {
    const row = after as Txn & StoredRow;
    await store.putRow('transactions', row);
    await store.enqueue('transactions', 'upsert', row, effectOfChange(before, after), isNew);
  }

  async function remove(before: Txn & StoredRow) {
    const now = store.now();
    const gone = { ...before, deleted_at: now, updated_at: now, client_updated_at: now } as Txn & StoredRow;
    await store.putRow('transactions', gone);
    await store.enqueue('transactions', 'delete', gone, effectOfChange(before, null));
  }

  async function newRow(d: TransactionDraft, extra: Partial<Txn> = {}): Promise<Txn> {
    const account = await accountOrThrow(d.account_id);
    checkAmount(d.amount);
    const now = store.now();
    return {
      id: newId(),
      account_id: d.account_id,
      kind: d.kind,
      amount: d.amount,
      currency: account.currency ?? base(),
      // The server converts other currencies at the day's rate; until then the amount stands in.
      amount_base: d.amount,
      fee: d.fee ?? 0,
      occurred_at: d.occurred_at,
      status: d.status ?? 'confirmed',
      source: 'manual',
      category_id: d.category_id ?? null,
      counterparty_text: d.counterparty_text?.trim() || undefined,
      note: d.note?.trim() || undefined,
      reference: d.reference?.trim() || undefined,
      transfer_group_id: null,
      split_parent_id: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 0,
      client_updated_at: now,
      ...extra,
    };
  }

  async function itemsFor(rows: Txn[]): Promise<TransactionItem[]> {
    const [accts, cats] = await Promise.all([
      store.read<{ json: string }>('SELECT json FROM accounts'),
      store.read<{ json: string }>('SELECT json FROM categories'),
    ]);
    const accountById = new Map(accts.map((r) => parse<Acct>(r.json)).map((a) => [a.id ?? '', a]));
    const categoryById = new Map(cats.map((r) => parse<Category>(r.json)).map((c) => [c.id, c]));

    // Both legs of a transfer become one item (placed where the first leg appears).
    const groups = new Map<string, Txn[]>();
    for (const t of rows)
      if (t.transfer_group_id) groups.set(t.transfer_group_id, [...(groups.get(t.transfer_group_id) ?? []), t]);
    const missing = [...groups.entries()].filter(([, legs]) => legs.length < 2).map(([g]) => g);
    if (missing.length) {
      const extra = await store.read<{ json: string }>(
        `SELECT json FROM transactions WHERE deleted_at IS NULL AND transfer_group_id IN (${missing.map(() => '?').join(',')})`,
        missing,
      );
      for (const t of extra.map((r) => parse<Txn>(r.json))) {
        const legs = groups.get(t.transfer_group_id!)!;
        if (!legs.some((l) => l.id === t.id)) legs.push(t);
      }
    }

    const seen = new Set<string>();
    const items: TransactionItem[] = [];
    for (const t of rows) {
      const g = t.transfer_group_id;
      if (g) {
        if (seen.has(g)) continue;
        seen.add(g);
        const legs = groups.get(g)!;
        const out = legs.find((l) => l.kind === 'out') ?? t;
        const inn = legs.find((l) => l.kind === 'in') ?? t;
        items.push({
          txn: out,
          category: null,
          account: accountById.get(out.account_id) ?? null,
          transfer: {
            out,
            in: inn,
            from: accountById.get(out.account_id) ?? null,
            to: accountById.get(inn.account_id) ?? null,
          },
        });
      } else {
        items.push({
          txn: t,
          category: (t.category_id && categoryById.get(t.category_id)) || null,
          account: accountById.get(t.account_id) ?? null,
          transfer: null,
        });
      }
    }
    return items;
  }

  function where(f: TransactionFilter, withParts = false): { sql: string; params: SqlValue[] } {
    const clauses = ['t.deleted_at IS NULL', ...(withParts ? [] : ['t.split_parent_id IS NULL'])];
    const params: SqlValue[] = [];
    if (f.from) {
      clauses.push('t.occurred_at >= ?');
      params.push(startOfDay(f.from, tz()));
    }
    if (f.to) {
      clauses.push('t.occurred_at < ?');
      params.push(startOfDay(f.to, tz()));
    }
    if (f.directions?.length) {
      const parts: string[] = [];
      if (f.directions.includes('transfer')) parts.push('t.transfer_group_id IS NOT NULL');
      const kinds = f.directions.filter((d): d is 'in' | 'out' => d !== 'transfer');
      if (kinds.length) {
        parts.push(`(t.transfer_group_id IS NULL AND t.kind IN (${kinds.map(() => '?').join(',')}))`);
        params.push(...kinds);
      }
      clauses.push(`(${parts.join(' OR ')})`);
    }
    if (f.accountIds?.length) {
      clauses.push(`t.account_id IN (${f.accountIds.map(() => '?').join(',')})`);
      params.push(...f.accountIds);
    }
    if (f.sources?.length) {
      clauses.push(`t.source IN (${f.sources.map(() => '?').join(',')})`);
      params.push(...f.sources);
    }
    if (f.statuses?.length) {
      clauses.push(`t.status IN (${f.statuses.map(() => '?').join(',')})`);
      params.push(...f.statuses);
    }
    if (f.categoryId) {
      clauses.push('t.category_id = ?');
      params.push(f.categoryId);
    }
    const q = f.q
      ?.trim()
      .toLowerCase()
      .replace(/[,\s]+/g, ' ');
    if (q) {
      // "18,500" and "18500" both find RWF 18,500.
      const digits = q.replace(/[^\d]/g, '');
      clauses.push(`(t.search LIKE ? OR c.name LIKE ?${digits ? ' OR t.search LIKE ?' : ''})`);
      params.push(`%${q}%`, `%${q}%`, ...(digits ? [`%${digits}%`] : []));
    }
    return { sql: clauses.join(' AND '), params };
  }

  const transactions = {
    /** Activity: newest first, transfers shown once. */
    async list(f: TransactionFilter = {}): Promise<TransactionItem[]> {
      const { sql, params } = where(f);
      const rows = await store.read<{ json: string }>(
        `SELECT t.json FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
         WHERE ${sql} ORDER BY t.occurred_at DESC, t.rowid DESC LIMIT ?`,
        [...params, f.limit ?? 1000],
      );
      return itemsFor(rows.map((r) => parse<Txn>(r.json)));
    },

    /** Income and spending for the filter (transfers and pending items excluded; split parts used). */
    async totals(f: TransactionFilter = {}): Promise<Totals & { count: number }> {
      // Parts carry their parent's account, direction, status and date, so the filter applies to them directly.
      const { sql, params } = where({ ...f, limit: undefined }, true);
      const rows = await store.read<{ json: string }>(
        `SELECT t.json FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE ${sql}`,
        params,
      );
      const list = rows.map((r) => parse<Txn>(r.json));
      const shown = list.filter((t) => !t.split_parent_id);
      const groups = new Set(shown.map((t) => t.transfer_group_id).filter(Boolean));
      return { ...totals(list), count: shown.filter((t) => !t.transfer_group_id).length + groups.size };
    },

    async get(id: string) {
      const t = await store.getRow<Txn & StoredRow>('transactions', id);
      if (!live(t)) return null;
      const [item] = await itemsFor([t]);
      const parts = t.has_parts
        ? await itemsFor(
            (
              await store.read<{ json: string }>(
                'SELECT json FROM transactions WHERE split_parent_id = ? AND deleted_at IS NULL ORDER BY rowid',
                [id],
              )
            ).map((r) => parse<Txn>(r.json)),
          )
        : [];
      return { ...item!, parts };
    },

    async create(d: TransactionDraft) {
      const row = await newRow(d);
      await store.write(() => save(null, row, true));
      return row;
    },

    async update(id: string, patch: Partial<TransactionDraft>) {
      return store.write(async () => {
        const before = await store.getRow<Txn & StoredRow>('transactions', id);
        if (!live(before)) throw new ValidationError('This transaction was deleted');
        if (before.transfer_group_id) throw new ValidationError('Edit the transfer instead');
        if (patch.amount !== undefined) checkAmount(patch.amount);
        const account = patch.account_id ? await accountOrThrow(patch.account_id) : null;
        const now = store.now();
        const after: Txn = {
          ...before,
          ...patch,
          ...(account ? { currency: account.currency } : {}),
          ...(patch.amount !== undefined ? { amount_base: patch.amount } : {}),
          counterparty_text: (patch.counterparty_text ?? before.counterparty_text)?.trim() || undefined,
          note: (patch.note ?? before.note)?.trim() || undefined,
          updated_at: now,
          client_updated_at: now,
        };
        await save(before, after);
        // Parts follow their parent's account, direction and status.
        if (before.has_parts) {
          const parts = await store.read<{ json: string }>(
            'SELECT json FROM transactions WHERE split_parent_id = ? AND deleted_at IS NULL',
            [id],
          );
          for (const p of parts.map((r) => parse<Txn>(r.json))) {
            await save(p, {
              ...p,
              account_id: after.account_id,
              kind: after.kind,
              status: after.status,
              updated_at: now,
              client_updated_at: now,
            });
          }
        }
        return after;
      });
    },

    /** Moves a pending (review) item into the totals. */
    confirm: (id: string) => transactions.update(id, { status: 'confirmed' }),

    /**
     * Deletes a transaction, both legs of a transfer, or a split parent with its parts.
     * Returns the rows as they were (the item first), for `restore` (Undo).
     */
    async remove(id: string): Promise<Txn[]> {
      return store.write(async () => {
        const t = await store.getRow<Txn & StoredRow>('transactions', id);
        if (!live(t)) return [];
        const related = (
          await store.read<{ json: string }>(
            `SELECT json FROM transactions WHERE deleted_at IS NULL AND id != ? AND
             ((transfer_group_id IS NOT NULL AND transfer_group_id = ?) OR split_parent_id = ?)`,
            [id, t.transfer_group_id ?? null, id],
          )
        ).map((r) => parse<Txn & StoredRow>(r.json));
        for (const r of related) await remove(r);
        await remove(t);
        return [t, ...related];
      });
    },

    /**
     * Undo for `remove`: puts the rows back. A delete still in the outbox merges with this upsert, so the
     * net balance effect is 0; a row deleted before it ever synced is queued as new again.
     */
    async restore(snapshot: readonly Txn[]) {
      await store.write(async () => {
        const now = store.now();
        for (const s of snapshot) {
          const current = await store.getRow<Txn & StoredRow>('transactions', s.id);
          if (current && !current.deleted_at) continue;
          await save(
            null,
            { ...s, version: current?.version ?? s.version, deleted_at: null, updated_at: now, client_updated_at: now },
            !current,
          );
        }
      });
    },

    async createTransfer(d: TransferDraft) {
      if (d.from_account_id === d.to_account_id)
        throw new ValidationError('Choose two different accounts', 'to_account_id');
      checkAmount(d.amount);
      const [from, to] = await Promise.all([accountOrThrow(d.from_account_id), accountOrThrow(d.to_account_id)]);
      const received = from.currency === to.currency ? d.amount : (d.received_amount ?? 0);
      checkAmount(received, 'received_amount');
      const group = newId();
      const out = await newRow(
        { account_id: from.id!, kind: 'out', amount: d.amount, fee: d.fee, occurred_at: d.occurred_at, note: d.note },
        { transfer_group_id: group, counterparty_text: to.name },
      );
      const inn = await newRow(
        { account_id: to.id!, kind: 'in', amount: received, occurred_at: d.occurred_at, note: d.note },
        { transfer_group_id: group, counterparty_text: from.name },
      );
      await store.write(async () => {
        await save(null, out, true);
        await save(null, inn, true);
      });
      return { group, out, in: inn };
    },

    /** Edits both legs together (doc 05 §4: legs are never edited one at a time). */
    async updateTransfer(groupId: string, d: TransferDraft) {
      if (d.from_account_id === d.to_account_id)
        throw new ValidationError('Choose two different accounts', 'to_account_id');
      checkAmount(d.amount);
      return store.write(async () => {
        const legs = (
          await store.read<{ json: string }>(
            'SELECT json FROM transactions WHERE transfer_group_id = ? AND deleted_at IS NULL',
            [groupId],
          )
        ).map((r) => parse<Txn & StoredRow>(r.json));
        const out = legs.find((l) => l.kind === 'out');
        const inn = legs.find((l) => l.kind === 'in');
        if (!out || !inn) throw new ValidationError('This transfer was deleted');
        const [from, to] = await Promise.all([accountOrThrow(d.from_account_id), accountOrThrow(d.to_account_id)]);
        const received = from.currency === to.currency ? d.amount : (d.received_amount ?? 0);
        checkAmount(received, 'received_amount');
        const now = store.now();
        const common = {
          occurred_at: d.occurred_at,
          note: d.note?.trim() || undefined,
          updated_at: now,
          client_updated_at: now,
        };
        await save(out, {
          ...out,
          ...common,
          account_id: from.id!,
          currency: from.currency ?? base(),
          amount: d.amount,
          amount_base: d.amount,
          fee: d.fee ?? 0,
          counterparty_text: to.name,
        });
        await save(inn, {
          ...inn,
          ...common,
          account_id: to.id!,
          currency: to.currency ?? base(),
          amount: received,
          amount_base: received,
          counterparty_text: from.name,
        });
      });
    },

    /** Splits across categories. The parent keeps the balance; totals use the parts. Replaces earlier parts. */
    async split(id: string, parts: readonly SplitPart[]) {
      return store.write(async () => {
        const parent = await store.getRow<Txn & StoredRow>('transactions', id);
        if (!live(parent)) throw new ValidationError('This transaction was deleted');
        if (parent.transfer_group_id) throw new ValidationError("Transfers can't be split");
        const problem = splitProblem(
          parent.amount,
          parts.map((p) => p.amount),
        );
        if (problem) throw new ValidationError(problem, 'parts');
        if (parts.some((p) => !p.category_id)) throw new ValidationError('Choose a category for each part', 'parts');

        const old = await store.read<{ json: string }>(
          'SELECT json FROM transactions WHERE split_parent_id = ? AND deleted_at IS NULL',
          [id],
        );
        for (const r of old) await remove(parse<Txn & StoredRow>(r.json));

        const now = store.now();
        const created: Txn[] = [];
        for (const p of parts) {
          const part: Txn = {
            ...parent,
            id: newId(),
            amount: p.amount,
            amount_base: p.amount,
            fee: 0,
            category_id: p.category_id,
            note: p.note?.trim() || undefined,
            split_parent_id: id,
            has_parts: false,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            version: 0,
            client_updated_at: now,
          };
          await save(null, part, true);
          created.push(part);
        }
        await save(parent, { ...parent, has_parts: true, updated_at: now, client_updated_at: now });
        return created;
      });
    },
  };

  return { accounts, categories, transactions };
}

export type Repositories = ReturnType<typeof createRepositories>;
