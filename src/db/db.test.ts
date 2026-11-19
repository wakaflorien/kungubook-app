import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createHandlers, createMockDb, createMockServer, kezaOf, seed, type MockDb } from '../../mocks/node';
import { createApiClient, memoryTokenStore, unwrap } from '../api';
import { createAuthService } from '../lib/auth/auth-service';
import { createRepositories } from './repositories';
import { createLocalStore } from './store';
import { createSyncEngine } from './sync';
import { nodeDriver } from './testing';

const { server, baseUrl } = createMockServer();
let mock: MockDb;
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
// A fresh server database for every test.
beforeEach(() => {
  mock = createMockDb();
  server.resetHandlers(...createHandlers(baseUrl, mock));
});
afterAll(() => server.close());

const MOMO = '0193a1b2-0000-7000-8000-000000000a01';
const BK = '0193a1b2-0000-7000-8000-000000000a03';
const FOOD = seed.categoryId(1);

/** One phone: its own encrypted-cache stand-in (SQLite in memory), API session and sync engine. */
async function device(clock?: { now: Date }) {
  const tokens = memoryTokenStore();
  const api = createApiClient({ baseUrl, appVersion: '0.1.0', platform: 'ios', tokens });
  await createAuthService(api, tokens).signIn(seed.DEMO_EMAIL, seed.DEMO_PASSWORD);
  const store = createLocalStore(nodeDriver(), clock ? { now: () => clock.now } : {});
  const repos = createRepositories(store, {});
  const sync = createSyncEngine({ store, api });
  return { api, store, sync, ...repos };
}

const offline = () => server.use(http.all(`${baseUrl}/sync/*`, () => HttpResponse.error()));
const online = () => server.resetHandlers(...createHandlers(baseUrl, mock));

const serverBalances = async (api: Awaited<ReturnType<typeof device>>['api']) => {
  const list = await unwrap(api.GET('/accounts'));
  return { total: list.total.amount, byId: Object.fromEntries(list.data.map((a) => [a.id, a.balance])) };
};
const localBalances = async (d: Awaited<ReturnType<typeof device>>) => ({
  total: (await d.accounts.total()).amount,
  byId: Object.fromEntries((await d.accounts.list()).map((a) => [a.id, a.balance])),
});

describe('first sync', () => {
  it('downloads accounts, categories and activity, and Home matches the API', async () => {
    const phone = await device();
    expect(await phone.sync.hasSynced()).toBe(false);
    await phone.sync.sync();

    expect(await phone.sync.hasSynced()).toBe(true);
    expect(await localBalances(phone)).toEqual(await serverBalances(phone.api));
    expect((await phone.accounts.total()).amount).toBe(3_480_000);
    expect(await phone.categories.list('out')).toHaveLength(14);
    expect(await phone.categories.list('in')).toHaveLength(4);

    // 8 rows, but the two legs of the BK → MoMo transfer show as one item.
    const items = await phone.transactions.list();
    expect(items).toHaveLength(7);
    const transfer = items.find((i) => i.transfer)!;
    expect([transfer.transfer!.from?.name, transfer.transfer!.to?.name]).toEqual(['BK Current', 'MTN MoMo']);
    expect(items[0]!.txn.counterparty_text).toBe('Kigali Grocers');
    expect(items[0]!.category?.name).toBe('Food & Groceries');
  });
});

describe('offline changes', () => {
  it('saves offline, then shows on a second phone after reconnecting, with matching balances', async () => {
    const a = await device();
    const b = await device();
    await a.sync.sync();
    await b.sync.sync();

    offline();
    const txn = await a.transactions.create({
      account_id: MOMO,
      kind: 'out',
      amount: 18_500,
      occurred_at: '2026-11-18T08:00:00Z',
      category_id: FOOD,
      counterparty_text: 'Simba Supermarket',
    });
    // The balance moves straight away, before any sync.
    expect((await a.accounts.get(MOMO))!.balance).toBe(412_400 - 18_500);
    await expect(a.sync.sync()).rejects.toMatchObject({ code: 'network' });
    expect(a.sync.status).toMatchObject({ phase: 'offline', unsynced: 1 });

    online();
    await a.sync.sync();
    expect(a.sync.status).toMatchObject({ phase: 'idle', unsynced: 0 });
    await b.sync.sync();

    expect((await b.transactions.get(txn.id))?.txn.counterparty_text).toBe('Simba Supermarket');
    const api = await serverBalances(a.api);
    expect(api.byId[MOMO]).toBe(412_400 - 18_500);
    expect(await localBalances(a)).toEqual(api);
    expect(await localBalances(b)).toEqual(api);
  });

  it('sends nothing for a row created and deleted before it synced', async () => {
    const a = await device();
    await a.sync.sync();
    const t = await a.transactions.create({
      account_id: MOMO,
      kind: 'in',
      amount: 1_000,
      occurred_at: '2026-11-18T08:00:00Z',
    });
    await a.transactions.update(t.id, { amount: 2_000 });
    expect((await a.store.counts()).unsynced).toBe(1);
    await a.transactions.remove(t.id);
    expect((await a.store.counts()).unsynced).toBe(0);
    expect((await a.accounts.get(MOMO))!.balance).toBe(412_400);
  });

  it('edits and deletes, keeping local and server balances equal', async () => {
    const a = await device();
    await a.sync.sync();
    const t = await a.transactions.create({
      account_id: MOMO,
      kind: 'out',
      amount: 10_000,
      occurred_at: '2026-11-18T08:00:00Z',
    });
    await a.sync.sync();
    await a.transactions.update(t.id, { amount: 12_000, account_id: BK });
    expect((await localBalances(a)).byId).toMatchObject({ [MOMO]: 412_400, [BK]: 1_240_000 - 12_000 });
    await a.sync.sync();
    expect(await localBalances(a)).toEqual(await serverBalances(a.api));

    await a.transactions.remove(t.id);
    await a.sync.sync();
    expect((await serverBalances(a.api)).total).toBe(3_480_000);
    expect(await localBalances(a)).toEqual(await serverBalances(a.api));
    expect(await a.transactions.get(t.id)).toBeNull();
  });
});

describe('undo delete', () => {
  const serverRow = (id: string) => kezaOf(mock).transactions.find((t) => t.id === id);

  it('restores a synced row: the pending delete merges away, so the balance effect is 0', async () => {
    const a = await device();
    await a.sync.sync();
    const t = await a.transactions.create({
      account_id: MOMO,
      kind: 'out',
      amount: 10_000,
      occurred_at: '2026-11-18T08:00:00Z',
    });
    await a.sync.sync();
    const before = await localBalances(a);

    const snapshot = await a.transactions.remove(t.id);
    expect(snapshot.map((r) => r.id)).toEqual([t.id]);
    expect((await a.accounts.get(MOMO))!.balance).toBe(before.byId[MOMO]! + 10_000);
    await a.transactions.restore(snapshot);

    expect((await a.transactions.get(t.id))?.txn.deleted_at).toBeNull();
    const outbox = await a.store.outbox(['pending']);
    expect(outbox).toMatchObject([{ row_id: t.id, op: 'upsert', effect: {}, is_new: false }]);
    expect(await a.store.pendingEffects()).toEqual({});
    expect(await localBalances(a)).toEqual(before);

    await a.sync.sync();
    expect(serverRow(t.id)?.deleted_at).toBeNull();
    expect(await localBalances(a)).toEqual(await serverBalances(a.api));
  });

  it('restores a row deleted before it ever synced, as a new row', async () => {
    const a = await device();
    await a.sync.sync();
    const t = await a.transactions.create({
      account_id: MOMO,
      kind: 'in',
      amount: 1_000,
      occurred_at: '2026-11-18T08:00:00Z',
    });
    const snapshot = await a.transactions.remove(t.id);
    expect((await a.store.counts()).unsynced).toBe(0);
    await a.transactions.restore(snapshot);

    expect(await a.transactions.get(t.id)).not.toBeNull();
    expect(await a.store.outbox(['pending'])).toMatchObject([
      { row_id: t.id, op: 'upsert', effect: { [MOMO]: 1_000 }, is_new: true },
    ]);
    expect((await a.accounts.get(MOMO))!.balance).toBe(412_400 + 1_000);

    await a.sync.sync();
    expect(serverRow(t.id)?.deleted_at).toBeNull();
    expect(await localBalances(a)).toEqual(await serverBalances(a.api));
  });

  it('restores both legs of a transfer, also after the delete was pushed', async () => {
    const a = await device();
    await a.sync.sync();
    const { out } = await a.transactions.createTransfer({
      from_account_id: BK,
      to_account_id: MOMO,
      amount: 50_000,
      occurred_at: '2026-11-18T09:00:00Z',
    });
    await a.sync.sync();
    const before = await localBalances(a);
    const legs = (await a.transactions.list({ directions: ['transfer'] })).find((i) => i.transfer?.out.id === out.id)!;

    // Undo before the delete is sent: both legs merge to a no-op.
    let snapshot = await a.transactions.remove(out.id);
    expect(snapshot.map((r) => r.id).sort()).toEqual([legs.transfer!.out.id, legs.transfer!.in.id].sort());
    await a.transactions.restore(snapshot);
    expect((await a.store.outbox(['pending'])).map((e) => [e.op, e.effect])).toEqual([
      ['upsert', {}],
      ['upsert', {}],
    ]);
    expect(await a.store.pendingEffects()).toEqual({});
    expect(await localBalances(a)).toEqual(before);
    await a.sync.sync();

    // Undo after the delete reached the server: the upsert brings the rows back there too.
    snapshot = await a.transactions.remove(out.id);
    await a.sync.sync();
    expect(serverRow(out.id)?.deleted_at).toBeTruthy();
    await a.transactions.restore(snapshot);
    await a.sync.sync();
    expect(snapshot.map((r) => serverRow(r.id)?.deleted_at)).toEqual([null, null]);
    expect(await localBalances(a)).toEqual(before);
    expect(await localBalances(a)).toEqual(await serverBalances(a.api));
  });
});

describe('transfers', () => {
  it('moves money between accounts without changing income or spending', async () => {
    const a = await device();
    await a.sync.sync();
    const month = { from: '2026-11-01', to: '2026-12-01' };
    const before = await a.transactions.totals(month);

    const { group } = await a.transactions.createTransfer({
      from_account_id: BK,
      to_account_id: MOMO,
      amount: 50_000,
      fee: 500,
      occurred_at: '2026-11-18T09:00:00Z',
    });
    const after = await a.transactions.totals(month);
    expect([after.income, after.spending]).toEqual([before.income, before.spending]);
    expect((await localBalances(a)).byId).toMatchObject({ [BK]: 1_240_000 - 50_500, [MOMO]: 412_400 + 50_000 });

    await a.sync.sync();
    expect(await localBalances(a)).toEqual(await serverBalances(a.api));
    const legs = kezaOf(mock).transactions.filter((t) => t.transfer_group_id === group);
    expect(legs.map((l) => [l.kind, l.amount, l.fee])).toEqual([
      ['out', 50_000, 500],
      ['in', 50_000, 0],
    ]);

    // Edited and deleted as a pair.
    await a.transactions.updateTransfer(group, {
      from_account_id: BK,
      to_account_id: MOMO,
      amount: 60_000,
      occurred_at: '2026-11-18T09:00:00Z',
    });
    await a.transactions.remove(legs[1]!.id!);
    await a.sync.sync();
    expect(kezaOf(mock).transactions.filter((t) => t.transfer_group_id === group && !t.deleted_at)).toHaveLength(0);
    expect(await localBalances(a)).toEqual(await serverBalances(a.api));
    expect((await serverBalances(a.api)).total).toBe(3_480_000);
  });

  it('server: deleting one leg of a transfer deletes both, so no money appears', async () => {
    const a = await device();
    await a.sync.sync();
    const { out } = await a.transactions.createTransfer({
      from_account_id: BK,
      to_account_id: MOMO,
      amount: 50_000,
      occurred_at: '2026-11-18T09:00:00Z',
    });
    await a.sync.sync();
    // Another client sends a delete for the out leg only.
    await unwrap(
      a.api.POST('/sync/push', {
        body: {
          changes: [
            {
              table: 'transactions',
              op: 'delete',
              row: { id: out.id, version: 1, client_updated_at: new Date().toISOString() },
            },
          ],
        },
      }),
    );
    expect(
      kezaOf(mock).transactions.filter((t) => t.transfer_group_id === out.transfer_group_id && !t.deleted_at),
    ).toHaveLength(0);
    expect((await serverBalances(a.api)).total).toBe(3_480_000);
    await a.sync.sync();
    expect(await localBalances(a)).toEqual(await serverBalances(a.api));
    expect((await a.transactions.list({ directions: ['transfer'] })).map((i) => i.txn.counterparty_text)).toEqual([
      'MTN MoMo',
    ]); // only the seeded transfer is left
  });

  it('refuses a transfer to the same account', async () => {
    const a = await device();
    await a.sync.sync();
    await expect(
      a.transactions.createTransfer({
        from_account_id: BK,
        to_account_id: BK,
        amount: 1,
        occurred_at: '2026-11-18T09:00:00Z',
      }),
    ).rejects.toThrow(/two different accounts/);
  });
});

describe('splits', () => {
  it('splits across categories: balance from the parent, totals from the parts', async () => {
    const a = await device();
    await a.sync.sync();
    const parent = await a.transactions.create({
      account_id: MOMO,
      kind: 'out',
      amount: 30_000,
      occurred_at: '2026-11-18T08:00:00Z',
      category_id: FOOD,
    });
    await expect(a.transactions.split(parent.id, [{ amount: 30_000, category_id: FOOD }])).rejects.toThrow(
      /at least two/,
    );
    await expect(
      a.transactions.split(parent.id, [
        { amount: 20_000, category_id: FOOD },
        { amount: 5_000, category_id: seed.categoryId(5) },
      ]),
    ).rejects.toThrow(/less than/);

    const before = await a.transactions.totals({ from: '2026-11-18', to: '2026-11-19' });
    await a.transactions.split(parent.id, [
      { amount: 20_000, category_id: FOOD },
      { amount: 10_000, category_id: seed.categoryId(5) },
    ]);
    const detail = await a.transactions.get(parent.id);
    expect(detail?.parts.map((p) => [p.txn.amount, p.category?.name])).toEqual([
      [20_000, 'Food & Groceries'],
      [10_000, 'Household'],
    ]);
    expect(await a.transactions.totals({ from: '2026-11-18', to: '2026-11-19' })).toEqual(before);
    expect(await a.transactions.totals({ from: '2026-11-18', to: '2026-11-19', categoryId: FOOD })).toMatchObject({
      spending: 20_000,
    });
    expect((await a.accounts.get(MOMO))!.balance).toBe(412_400 - 30_000);

    await a.sync.sync();
    expect(kezaOf(mock).transactions.find((t) => t.id === parent.id)?.has_parts).toBe(true);
    expect(await localBalances(a)).toEqual(await serverBalances(a.api));
  });
});

describe('conflicts', () => {
  it('keeps the later edit (last write wins) and logs the losing copy', async () => {
    const clockA = { now: new Date('2026-11-18T10:00:00Z') };
    const clockB = { now: new Date('2026-11-18T10:00:00Z') };
    const a = await device(clockA);
    const b = await device(clockB);
    await a.sync.sync();
    await b.sync.sync();
    const id = '0193a1b2-0000-7000-8000-000000000b02'; // SP Nyarutarama

    clockB.now = new Date('2026-11-18T10:05:00Z');
    await b.transactions.update(id, { note: 'Fuel, from B (later)' });
    clockA.now = new Date('2026-11-18T10:01:00Z');
    await a.transactions.update(id, { note: 'Fuel, from A (earlier)' });

    await b.sync.sync();
    await a.sync.sync(); // A's version is stale and its edit older: the server keeps B's.
    expect((await a.transactions.get(id))?.txn.note).toBe('Fuel, from B (later)');
    expect(await a.store.read('SELECT * FROM sync_conflicts')).toHaveLength(1);
    expect(kezaOf(mock).transactions.find((t) => t.id === id)?.note).toBe('Fuel, from B (later)');
  });

  it('marks a change the server refuses, and keeps it for a retry', async () => {
    const a = await device();
    await a.sync.sync();
    await a.transactions.create({ account_id: MOMO, kind: 'out', amount: 1_000, occurred_at: '2026-11-18T08:00:00Z' });
    // The account was deleted on another phone in the meantime.
    Object.assign(
      kezaOf(mock).accounts.find((x) => x.id === MOMO)!,
      { deleted_at: '2026-11-18T07:00:00Z' },
    );
    await a.sync.sync();
    expect(a.sync.status).toMatchObject({ rejected: 1, unsynced: 0 });
    await a.sync.retryRejected();
    expect((await a.store.counts()).unsynced).toBe(1);
  });
});

describe('activity filters and search', () => {
  it('filters by direction, account, status and search text', async () => {
    const a = await device();
    await a.sync.sync();
    const names = async (f: Parameters<typeof a.transactions.list>[0]) =>
      (await a.transactions.list(f)).map((i) => i.txn.counterparty_text);

    expect(await names({ directions: ['transfer'] })).toEqual(['MTN MoMo']);
    expect(await names({ directions: ['in'] })).toEqual(['Inyange Industries', 'Aline Umutoni']);
    expect(await names({ statuses: ['pending_review'] })).toEqual(['Kigali Grocers']);
    expect(await names({ accountIds: [MOMO], directions: ['out'] })).toEqual(['Kigali Grocers', 'MTN Airtime']);
    expect(await names({ q: 'kigali' })).toEqual(['Kigali Grocers']);
    expect(await names({ q: '18,500' })).toEqual(['Kigali Grocers']);
    expect(await names({ q: 'eating' })).toEqual(['Java House']); // by category name
    expect(await names({ sources: ['sms'] })).toEqual(['Aline Umutoni', 'MTN Airtime']);
    expect(await names({ from: '2026-11-16', to: '2026-11-17' })).toEqual(['Inyange Industries', 'SP Nyarutarama']);
  });

  it('totals the month: pending items and the transfer stay out', async () => {
    const a = await device();
    await a.sync.sync();
    const t = await a.transactions.totals({ from: '2026-11-01', to: '2026-12-01' });
    expect(t).toEqual({ income: 650_000 + 30_000, spending: 22_000 + 14_000 + 5_000, count: 7 });
  });
});
