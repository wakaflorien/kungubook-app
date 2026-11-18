/**
 * Stateful MSW handlers for flows where the mock must remember changes
 * (add a transaction, then see it in Activity and in the account balance).
 * Prism (`pnpm mock`) covers everything else statelessly.
 */
import { http, HttpResponse } from 'msw';
import type { Account, Transaction, components } from '../src/api';
import { accounts, accountsTotal, transactions, user } from './seed';

type TransactionInput = components['schemas']['TransactionInput'];

export interface MockDb {
  accounts: Account[];
  transactions: Transaction[];
  /** Valid access tokens; refresh tokens rotate on every use. */
  accessTokens: Set<string>;
  refreshTokens: Set<string>;
  /** Requests below this X-App-Version get 426. */
  minAppVersion: string;
}

export function createMockDb(): MockDb {
  return {
    accounts: structuredClone(accounts),
    transactions: structuredClone(transactions),
    accessTokens: new Set(['mock-access-1']),
    refreshTokens: new Set(['mock-refresh-1']),
    minAppVersion: '0.1.0',
  };
}

const err = (status: number, code: string, message: string) =>
  HttpResponse.json({ error: { code, message } }, { status });

const semver = (v: string) =>
  v
    .split(/[ .]/)
    .slice(0, 3)
    .map((p) => Number.parseInt(p, 10) || 0);
const older = (a: string, b: string) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! < y[i]!;
  return false;
};

export function createHandlers(baseUrl: string, db: MockDb = createMockDb()) {
  const url = (path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;
  let tokenSeq = 1;

  /** Returns an error response, or null when the request may proceed. */
  const guard = (request: Request, { auth = true } = {}) => {
    const version = request.headers.get('X-App-Version');
    if (version && older(version, db.minAppVersion)) return err(426, 'upgrade_required', 'Update the app');
    if (!auth) return null;
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!token) return err(401, 'unauthorized', 'Missing token');
    if (!db.accessTokens.has(token)) return err(401, 'token_expired', 'Access token expired');
    return null;
  };

  return [
    http.get(
      url('/health'),
      ({ request }) =>
        guard(request, { auth: false }) ?? HttpResponse.json({ status: 'ok', min_app_version: db.minAppVersion }),
    ),

    http.post(url('/auth/refresh'), async ({ request }) => {
      const denied = guard(request, { auth: false });
      if (denied) return denied;
      const { refresh_token } = (await request.json()) as { refresh_token?: string };
      if (!refresh_token || !db.refreshTokens.has(refresh_token)) {
        db.refreshTokens.clear(); // reuse of a revoked token revokes every session
        return err(401, 'unauthorized', 'Refresh token revoked');
      }
      db.refreshTokens.delete(refresh_token);
      tokenSeq += 1;
      const session = {
        access_token: `mock-access-${tokenSeq}`,
        refresh_token: `mock-refresh-${tokenSeq}`,
        expires_in: 900,
        user,
      };
      db.accessTokens.add(session.access_token);
      db.refreshTokens.add(session.refresh_token);
      return HttpResponse.json(session);
    }),

    http.get(url('/accounts'), ({ request }) => {
      const denied = guard(request);
      if (denied) return denied;
      const live = db.accounts.filter((a) => !a.deleted_at && !a.archived);
      return HttpResponse.json({ data: live, total: { amount: accountsTotal(live), currency: 'RWF' } });
    }),

    http.get(url('/transactions'), ({ request }) => {
      const denied = guard(request);
      if (denied) return denied;
      const data = [...db.transactions]
        .filter((t) => !t.deleted_at)
        .sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''));
      return HttpResponse.json({ data, next_cursor: null });
    }),

    http.post(url('/transactions'), async ({ request }) => {
      const denied = guard(request);
      if (denied) return denied;
      const input = (await request.json()) as TransactionInput;
      const existing = db.transactions.find((t) => t.id === input.id);
      if (existing) return HttpResponse.json({ transaction: existing }, { status: 200 });

      const acct = db.accounts.find((a) => a.id === input.account_id);
      if (!input.id || !acct || !input.kind || !input.amount || input.amount < 1) {
        return HttpResponse.json(
          {
            error: {
              code: 'validation_failed',
              message: 'id, account_id, kind and amount > 0 are required',
              fields: { amount: 'must be greater than 0' },
            },
          },
          { status: 422 },
        );
      }
      const now = new Date().toISOString();
      const t: Transaction = {
        ...input,
        id: input.id,
        account_id: acct.id,
        kind: input.kind,
        amount: input.amount,
        currency: input.currency ?? acct.currency,
        amount_base: input.amount,
        fee: input.fee ?? 0,
        occurred_at: input.occurred_at ?? now,
        status: input.status ?? 'confirmed',
        source: 'manual',
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 1,
      };
      db.transactions.push(t);
      if (t.status === 'confirmed') {
        // The mock plays the server here: it owns the read-only computed fields.
        const amount = t.amount ?? 0;
        const delta = t.kind === 'in' ? amount : -(amount + (t.fee ?? 0));
        Object.assign(acct, {
          balance: acct.balance + delta,
          balance_base: acct.balance_base + delta,
          version: acct.version + 1,
        });
      }
      return HttpResponse.json({ transaction: t }, { status: 201 });
    }),
  ];
}
