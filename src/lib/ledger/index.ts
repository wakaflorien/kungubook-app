/**
 * Ledger rules shared by the local repositories, the sync engine and the mock server (TRD §3, doc 05 §4):
 * - Balances: opening balance + confirmed rows. Transfer legs count; split parts don't (the parent does);
 *   pending (review) and deleted rows never count. The fee is paid from the account on `out` rows.
 * - Income and spending: confirmed, not a transfer leg, not a split parent (its parts count instead).
 * Pure TypeScript: no React Native imports, so the web app and the mock can use it too.
 */

/** The fields of a transaction these rules read. */
export interface LedgerRow {
  account_id: string;
  kind: 'in' | 'out';
  amount: number;
  amount_base?: number | null;
  fee?: number | null;
  status?: 'pending_review' | 'confirmed' | null;
  occurred_at: string;
  deleted_at?: string | null;
  transfer_group_id?: string | null;
  split_parent_id?: string | null;
  has_parts?: boolean | null;
}

/** Change to one account's balance, in the account's currency. */
export type BalanceEffect = Record<string, number>;

const counts = (t: LedgerRow) => t.status !== 'pending_review' && !t.deleted_at;

/** What this row adds to its account's balance (empty when it doesn't count). */
export function balanceEffect(t: LedgerRow | null | undefined): BalanceEffect {
  if (!t || !counts(t) || t.split_parent_id) return {};
  const delta = t.kind === 'in' ? t.amount : -(t.amount + (t.fee ?? 0));
  return delta ? { [t.account_id]: delta } : {};
}

/** Adds effects together, dropping accounts that end at zero. */
export function addEffects(...effects: BalanceEffect[]): BalanceEffect {
  const out: BalanceEffect = {};
  for (const e of effects) for (const [k, v] of Object.entries(e)) out[k] = (out[k] ?? 0) + v;
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

/** The effect of replacing `before` with `after` (either may be missing for a create or delete). */
export const effectOfChange = (before?: LedgerRow | null, after?: LedgerRow | null): BalanceEffect =>
  addEffects(balanceEffect(after), Object.fromEntries(Object.entries(balanceEffect(before)).map(([k, v]) => [k, -v])));

/** Counts toward income, spending, budgets and insights. */
export const countsInTotals = (t: LedgerRow) => counts(t) && !t.transfer_group_id && !t.has_parts;

export interface Totals {
  income: number;
  spending: number;
}

/** Income and spending in the base currency. Transfers never change either. */
export function totals(rows: readonly LedgerRow[]): Totals {
  let income = 0;
  let spending = 0;
  for (const t of rows) {
    if (!countsInTotals(t)) continue;
    const base = t.amount_base ?? t.amount;
    if (t.kind === 'in') income += base;
    else spending += base + (t.fee ?? 0);
  }
  return { income, spending };
}

export const DEFAULT_TIME_ZONE = 'Africa/Kigali';

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar day (`YYYY-MM-DD`) of an instant in the user's time zone. */
export function dayKey(iso: string, timeZone = DEFAULT_TIME_ZONE): string {
  let f = dayFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFormatters.set(timeZone, f);
  }
  const parts = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Midnight at the start of `day` in `timeZone`, as an instant. Kigali has no daylight saving. */
export function startOfDay(day: string, timeZone = DEFAULT_TIME_ZONE): string {
  const guess = new Date(`${day}T00:00:00Z`);
  // Offset of the zone at that moment, from how the zone shows the UTC instant.
  const shown = new Date(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .format(guess)
      .replace(/(\d+)\/(\d+)\/(\d+), /, '$3-$1-$2T')
      .concat('Z'),
  );
  return new Date(guess.getTime() - (shown.getTime() - guess.getTime())).toISOString();
}

export interface DayGroup<T> {
  day: string;
  rows: T[];
  /** Income minus spending that day (transfers excluded). */
  net: number;
}

/** Newest day first, rows newest first. */
export function groupByDay<T extends LedgerRow>(rows: readonly T[], timeZone = DEFAULT_TIME_ZONE): DayGroup<T>[] {
  const sorted = [...rows].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const groups: DayGroup<T>[] = [];
  for (const row of sorted) {
    const day = dayKey(row.occurred_at, timeZone);
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) {
      g = { day, rows: [], net: 0 };
      groups.push(g);
    }
    g.rows.push(row);
  }
  for (const g of groups) {
    const { income, spending } = totals(g.rows);
    g.net = income - spending;
  }
  return groups;
}

export type Period = 'week' | 'month' | 'last_month' | 'year' | 'all';

/** The `[from, to)` days for a period, relative to `today` (YYYY-MM-DD). Weeks start on Monday by default. */
export function periodRange(period: Period, today: string, weekStartsOn = 1): { from?: string; to?: string } {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const utc = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm - 1, dd));
  switch (period) {
    case 'week': {
      const date = utc(y, m, d);
      const back = (date.getUTCDay() - weekStartsOn + 7) % 7;
      const start = utc(y, m, d - back);
      return { from: iso(start), to: iso(utc(y, m, d - back + 7)) };
    }
    case 'month':
      return { from: iso(utc(y, m, 1)), to: iso(utc(y, m + 1, 1)) };
    case 'last_month':
      return { from: iso(utc(y, m - 1, 1)), to: iso(utc(y, m, 1)) };
    case 'year':
      return { from: iso(utc(y, 1, 1)), to: iso(utc(y + 1, 1, 1)) };
    case 'all':
      return {};
  }
}

/** Checks a split before it is saved: at least two parts, each above zero, adding up to the total. */
export function splitProblem(total: number, parts: readonly number[]): string | null {
  if (parts.length < 2) return 'Split it into at least two parts';
  if (parts.some((p) => !Number.isInteger(p) || p < 1)) return 'Each part needs an amount';
  const sum = parts.reduce((a, b) => a + b, 0);
  if (sum !== total) return sum < total ? 'Parts add up to less than the total' : 'Parts add up to more than the total';
  return null;
}
