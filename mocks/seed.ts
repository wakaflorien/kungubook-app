/**
 * Demo data for MSW and tests: the fictional user Keza Uwase from design/sample-data.md.
 * IDs match the examples in docs/openapi.yaml, so Prism and MSW agree. "Today" is Tue 17 Nov 2026.
 */
import type { Account, Transaction, components } from '../src/api';

type User = components['schemas']['User'];
type Category = components['schemas']['Category'];
type Settings = components['schemas']['Settings'];

export const TODAY = '2026-11-17';

/**
 * Test credentials for the demo user, valid only on the local mock server (`pnpm mock`) and in tests.
 * Fictional, like everything in this file.
 */
export const DEMO_EMAIL = 'keza@example.com';
export const DEMO_PASSWORD = 'kungubook-demo';
/** Reset-link token the mock accepts on POST /auth/password/reset. */
export const DEMO_RESET_TOKEN = 'mock-reset-token';

export const user: User = {
  id: '0193a1b2-0000-7000-8000-000000000001',
  email: 'keza@example.com',
  display_name: 'Keza Uwase',
  country: 'RW',
  base_currency: 'RWF',
  timezone: 'Africa/Kigali',
  week_starts_on: 1,
  currencies: ['USD'],
  sign_in_methods: ['password'],
  email_verified: true,
};

/** Account IDs (the generated `Account.id` is optional because of how the spec composes allOf). */
const accountId = (n: number) => `0193a1b2-0000-7000-8000-000000000a0${n}`;

const meta = (updated_at: string, version: number) => ({
  created_at: '2026-01-01T08:00:00Z',
  updated_at,
  deleted_at: null,
  version,
});

const account = (
  n: number,
  a: Pick<Account, 'type' | 'name' | 'provider' | 'balance'> & { number_last?: string; reported?: number },
  updated_at: string,
  version: number,
): Account => ({
  id: accountId(n),
  type: a.type,
  name: a.name,
  provider: a.provider,
  ...(a.number_last ? { number_last: a.number_last } : {}),
  currency: 'RWF',
  opening_balance: 0,
  opening_date: '2026-01-01',
  include_in_total: true,
  balance: a.balance,
  balance_base: a.balance,
  last_reported_balance: a.reported ?? (a.type === 'mobile_money' ? a.balance : null),
  sort_order: n - 1,
  ...meta(updated_at, version),
});

/** 5 accounts, total RWF 3,480,000. Airtel shows the mismatch example (last SMS said 150,000). */
export const accounts: Account[] = [
  account(
    1,
    { type: 'mobile_money', name: 'MTN MoMo', provider: 'mtn_momo', number_last: '214', balance: 412_400 },
    '2026-11-17T09:42:10Z',
    14,
  ),
  account(
    2,
    {
      type: 'mobile_money',
      name: 'Airtel Money',
      provider: 'airtel_money',
      number_last: '908',
      balance: 145_000,
      reported: 150_000,
    },
    '2026-11-16T18:10:00Z',
    9,
  ),
  account(
    3,
    { type: 'bank', name: 'BK Current', provider: 'bk', number_last: '5521', balance: 1_240_000 },
    '2026-11-17T07:00:00Z',
    22,
  ),
  account(
    4,
    { type: 'bank', name: 'Equity Savings', provider: 'equity', number_last: '0377', balance: 1_620_000 },
    '2026-11-01T07:00:00Z',
    6,
  ),
  account(5, { type: 'cash', name: 'Cash', provider: 'cash', balance: 62_600 }, '2026-11-15T12:00:00Z', 30),
];

const [momo, airtel, bk, cash] = [accountId(1), accountId(2), accountId(3), accountId(5)];
const TRANSFER_GROUP = '0193a1b2-0000-7000-8000-000000000d01';

/**
 * The default categories every new user gets (screen 84): 14 for money out, 4 for money in.
 * `id` is a function so each mock user gets their own rows; Keza's use fixed IDs (…c01–c18).
 */
export const DEFAULT_CATEGORIES: { name: string; direction: 'in' | 'out'; icon: string }[] = [
  { name: 'Food & Groceries', direction: 'out', icon: 'shopping_basket' },
  { name: 'Transport', direction: 'out', icon: 'two_wheeler' },
  { name: 'Eating out', direction: 'out', icon: 'restaurant' },
  { name: 'Utilities', direction: 'out', icon: 'bolt' },
  { name: 'Household', direction: 'out', icon: 'chair' },
  { name: 'Rent', direction: 'out', icon: 'home' },
  { name: 'Airtime & data', direction: 'out', icon: 'phone_iphone' },
  { name: 'School fees', direction: 'out', icon: 'school' },
  { name: 'Health', direction: 'out', icon: 'local_hospital' },
  { name: 'Family support', direction: 'out', icon: 'family_restroom' },
  { name: 'Shopping', direction: 'out', icon: 'shopping_bag' },
  { name: 'Entertainment', direction: 'out', icon: 'movie' },
  { name: 'Fees & charges', direction: 'out', icon: 'receipt' },
  { name: 'Other', direction: 'out', icon: 'more_horiz' },
  { name: 'Salary', direction: 'in', icon: 'payments' },
  { name: 'Consulting', direction: 'in', icon: 'work' },
  { name: 'Loan repayment', direction: 'in', icon: 'handshake' },
  { name: 'Interest', direction: 'in', icon: 'percent' },
];

export const categoryId = (n: number) => `0193a1b2-0000-7000-8000-000000000c${String(n).padStart(2, '0')}`;

export function makeCategories(id: (n: number) => string, at = '2026-01-01T08:00:00Z'): Category[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({
    id: id(i + 1),
    ...c,
    sort_order: i,
    is_system: true,
    created_at: at,
    updated_at: at,
    deleted_at: null,
    version: 1,
  }));
}

export const categories: Category[] = makeCategories(categoryId);
const cat = (name: string) => categories.find((c) => c.name === name)!.id;

const txn = (
  n: number,
  t: {
    account_id: string;
    kind: 'in' | 'out';
    amount: number;
    occurred_at: string;
    source: Transaction['source'];
    counterparty_text: string;
    note?: string;
    category_id?: string | null;
    status?: Transaction['status'];
    transfer_group_id?: string | null;
  },
): Transaction => ({
  id: `0193a1b2-0000-7000-8000-000000000b${String(n).padStart(2, '0')}`,
  currency: 'RWF',
  amount_base: t.amount,
  fee: 0,
  status: 'confirmed',
  ...t,
  ...meta(t.occurred_at, 1),
});

/**
 * Recent activity (screens 01 and 02). These rows describe history: the seeded balances above already include
 * them, so the mock never re-applies them. Kigali Grocers is still in Review, so it isn't in any balance.
 */
export const transactions: Transaction[] = [
  txn(1, {
    account_id: bk,
    kind: 'in',
    amount: 650_000,
    occurred_at: '2026-11-16T10:05:00Z',
    source: 'import',
    counterparty_text: 'Inyange Industries',
    note: 'Consulting payout',
    category_id: cat('Consulting'),
  }),
  txn(2, {
    account_id: cash,
    kind: 'out',
    amount: 22_000,
    occurred_at: '2026-11-16T07:30:00Z',
    source: 'manual',
    counterparty_text: 'SP Nyarutarama',
    category_id: cat('Transport'),
  }),
  txn(3, {
    account_id: airtel,
    kind: 'in',
    amount: 30_000,
    occurred_at: '2026-11-15T15:12:00Z',
    source: 'sms',
    counterparty_text: 'Aline Umutoni',
    note: 'Loan repayment',
    category_id: cat('Loan repayment'),
  }),
  txn(4, {
    account_id: momo,
    kind: 'out',
    amount: 18_500,
    occurred_at: '2026-11-17T09:42:10Z',
    source: 'shortcut',
    counterparty_text: 'Kigali Grocers',
    category_id: cat('Food & Groceries'),
    status: 'pending_review',
  }),
  // A transfer: two legs sharing a group (doc 05 §4). Neither counts as income or spending.
  txn(5, {
    account_id: bk,
    kind: 'out',
    amount: 200_000,
    occurred_at: '2026-11-15T09:00:00Z',
    source: 'import',
    counterparty_text: 'MTN MoMo',
    transfer_group_id: TRANSFER_GROUP,
  }),
  txn(6, {
    account_id: momo,
    kind: 'in',
    amount: 200_000,
    occurred_at: '2026-11-15T09:00:00Z',
    source: 'import',
    counterparty_text: 'BK Current',
    transfer_group_id: TRANSFER_GROUP,
  }),
  txn(7, {
    account_id: cash,
    kind: 'out',
    amount: 14_000,
    occurred_at: '2026-11-14T17:20:00Z',
    source: 'manual',
    counterparty_text: 'Java House',
    category_id: cat('Eating out'),
  }),
  txn(8, {
    account_id: momo,
    kind: 'out',
    amount: 5_000,
    occurred_at: '2026-11-13T08:15:00Z',
    source: 'sms',
    counterparty_text: 'MTN Airtime',
    category_id: cat('Airtime & data'),
  }),
];

export const accountsTotal = (list: Account[]) =>
  list.filter((a) => a.include_in_total && !a.deleted_at).reduce((sum, a) => sum + a.balance_base, 0);

/** Defaults from SettingsInput in the spec. */
export const defaultSettings = (): Settings => ({
  reminder_lead_days: [7, 1, 0],
  quiet_start: '22:00',
  quiet_end: '07:00',
  channels: {
    payment_out: ['push', 'email'],
    payment_in: ['push'],
    overdue: ['push', 'email'],
    budget: ['push'],
    review_inbox: ['push'],
  },
  weekly_summary: false,
  analytics_opt_in: false,
  hide_amounts: false,
  appearance: 'system',
  version: 1,
});
