import { describe, expect, it } from 'vitest';
import {
  balanceEffect,
  dayKey,
  effectOfChange,
  groupByDay,
  periodRange,
  splitProblem,
  startOfDay,
  totals,
  type LedgerRow,
} from '.';

const row = (r: Partial<LedgerRow>): LedgerRow => ({
  account_id: 'momo',
  kind: 'out',
  amount: 1000,
  occurred_at: '2026-11-17T09:00:00Z',
  status: 'confirmed',
  ...r,
});

describe('balance effects', () => {
  it('adds money in, takes money out with its fee', () => {
    expect(balanceEffect(row({ kind: 'in', amount: 650_000 }))).toEqual({ momo: 650_000 });
    expect(balanceEffect(row({ amount: 18_500, fee: 250 }))).toEqual({ momo: -18_750 });
  });

  it('ignores pending, deleted and split-part rows', () => {
    expect(balanceEffect(row({ status: 'pending_review' }))).toEqual({});
    expect(balanceEffect(row({ deleted_at: '2026-11-17T10:00:00Z' }))).toEqual({});
    expect(balanceEffect(row({ split_parent_id: 'p' }))).toEqual({});
  });

  it('counts both legs of a transfer in the balances', () => {
    const out = row({ account_id: 'bk', amount: 200_000, transfer_group_id: 'g' });
    const inn = row({ account_id: 'momo', kind: 'in', amount: 200_000, transfer_group_id: 'g' });
    expect({ ...balanceEffect(out), ...balanceEffect(inn) }).toEqual({ bk: -200_000, momo: 200_000 });
  });

  it('gives the net effect of an edit, a move and a delete', () => {
    const before = row({ amount: 10_000 });
    expect(effectOfChange(before, { ...before, amount: 12_000 })).toEqual({ momo: -2_000 });
    expect(effectOfChange(before, { ...before, account_id: 'cash' })).toEqual({ momo: 10_000, cash: -10_000 });
    expect(effectOfChange(before, null)).toEqual({ momo: 10_000 });
    expect(effectOfChange(null, before)).toEqual({ momo: -10_000 });
    expect(effectOfChange(before, { ...before, note: 'same money' } as LedgerRow)).toEqual({});
  });
});

describe('income and spending', () => {
  it('never counts transfers, pending or deleted rows', () => {
    const t = totals([
      row({ kind: 'in', amount: 650_000 }),
      row({ amount: 22_000 }),
      row({ amount: 18_500, status: 'pending_review' }),
      row({ amount: 200_000, transfer_group_id: 'g' }),
      row({ kind: 'in', amount: 200_000, transfer_group_id: 'g' }),
      row({ amount: 9_999, deleted_at: '2026-11-17T10:00:00Z' }),
    ]);
    expect(t).toEqual({ income: 650_000, spending: 22_000 });
  });

  it('uses split parts instead of the parent, and the base amount for other currencies', () => {
    const t = totals([
      row({ amount: 30_000, has_parts: true }),
      row({ amount: 20_000, split_parent_id: 'p' }),
      row({ amount: 10_000, split_parent_id: 'p' }),
      row({ amount: 10, amount_base: 13_500 }),
    ]);
    expect(t.spending).toBe(30_000 + 13_500);
  });
});

describe('days and periods (Africa/Kigali, UTC+2)', () => {
  it('puts late-evening UTC times on the next Kigali day', () => {
    expect(dayKey('2026-11-16T21:59:00Z')).toBe('2026-11-16');
    expect(dayKey('2026-11-16T22:00:00Z')).toBe('2026-11-17');
    expect(startOfDay('2026-11-17')).toBe('2026-11-16T22:00:00.000Z');
    expect(startOfDay('2026-11-17', 'UTC')).toBe('2026-11-17T00:00:00.000Z');
  });

  it('groups newest day first with the day’s net (transfers excluded)', () => {
    const groups = groupByDay([
      row({ occurred_at: '2026-11-16T10:00:00Z', kind: 'in', amount: 650_000 }),
      row({ occurred_at: '2026-11-17T09:00:00Z', amount: 18_500 }),
      row({ occurred_at: '2026-11-16T07:30:00Z', amount: 22_000 }),
      row({ occurred_at: '2026-11-16T08:00:00Z', amount: 200_000, transfer_group_id: 'g' }),
    ]);
    expect(groups.map((g) => [g.day, g.rows.length, g.net])).toEqual([
      ['2026-11-17', 1, -18_500],
      ['2026-11-16', 3, 628_000],
    ]);
  });

  it('works out week, month, last month and year ranges', () => {
    expect(periodRange('week', '2026-11-17')).toEqual({ from: '2026-11-16', to: '2026-11-23' });
    expect(periodRange('week', '2026-11-22')).toEqual({ from: '2026-11-16', to: '2026-11-23' });
    expect(periodRange('month', '2026-11-17')).toEqual({ from: '2026-11-01', to: '2026-12-01' });
    expect(periodRange('last_month', '2026-01-10')).toEqual({ from: '2025-12-01', to: '2026-01-01' });
    expect(periodRange('year', '2026-11-17')).toEqual({ from: '2026-01-01', to: '2027-01-01' });
    expect(periodRange('all', '2026-11-17')).toEqual({});
  });
});

describe('splits', () => {
  it('needs two or more parts that add up exactly', () => {
    expect(splitProblem(30_000, [20_000, 10_000])).toBeNull();
    expect(splitProblem(30_000, [30_000])).toMatch(/at least two/);
    expect(splitProblem(30_000, [20_000, 0])).toMatch(/amount/);
    expect(splitProblem(30_000, [20_000, 5_000])).toMatch(/less/);
    expect(splitProblem(30_000, [20_000, 15_000])).toMatch(/more/);
  });
});
