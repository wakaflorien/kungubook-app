/**
 * Stateful MSW handlers for the flows where the mock must remember changes:
 * sign-up and sign-in, the signed-in user, settings, devices, accounts and transactions.
 *
 * Used by Vitest (msw/node) and by the local mock server (`pnpm mock`, scripts/mock-server.ts),
 * which sends every other route to Prism. Several users can exist; Keza Uwase is seeded.
 */
import { http, HttpResponse } from 'msw';
import type { Account, Transaction, components } from '../src/api';
import { createChangeLog, pull, push, touch, type ChangeLog, type SyncTable } from './sync';
import {
  categories,
  makeCategories,
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_RESET_TOKEN,
  accounts,
  accountsTotal,
  defaultSettings,
  transactions,
  user as kezaUser,
} from './seed';

type User = components['schemas']['User'];
type UserInput = components['schemas']['UserInput'];
type Settings = components['schemas']['Settings'];
type SettingsInput = components['schemas']['SettingsInput'];
type AccountInput = components['schemas']['AccountInput'];
type TransactionInput = components['schemas']['TransactionInput'];
type Device = components['schemas']['Device'];
type Category = components['schemas']['Category'];

export interface MockUser {
  user: User;
  password: string;
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  devices: Device[];
}

export interface MockDb {
  /** By user id. */
  users: Map<string, MockUser>;
  /** Access token → user id. */
  accessTokens: Map<string, string>;
  /** Refresh token → user id. Refresh tokens rotate on every use. */
  refreshTokens: Map<string, string>;
  /** Requests below this X-App-Version get 426. */
  minAppVersion: string;
  /** Every row write, for /sync/pull cursors. */
  log: ChangeLog;
}

export const KEZA_ID = kezaUser.id;

export function createMockDb(): MockDb {
  const keza: MockUser = {
    user: structuredClone(kezaUser),
    password: DEMO_PASSWORD,
    settings: defaultSettings(),
    accounts: structuredClone(accounts),
    categories: structuredClone(categories),
    transactions: structuredClone(transactions),
    devices: [],
  };
  const log = createChangeLog();
  for (const r of [...keza.accounts, ...keza.categories, ...keza.transactions]) touch(log, r.id!);
  return {
    log,
    users: new Map([[KEZA_ID, keza]]),
    accessTokens: new Map([['mock-access-1', KEZA_ID]]),
    refreshTokens: new Map([['mock-refresh-1', KEZA_ID]]),
    minAppVersion: '0.1.0',
  };
}

/** Keza's data, for tests. */
export const kezaOf = (db: MockDb): MockUser => db.users.get(KEZA_ID)!;

const err = (status: number, code: string, message: string, fields?: Record<string, string>) =>
  HttpResponse.json({ error: { code, message, ...(fields ? { fields } : {}) } }, { status });

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

const nowIso = () => new Date().toISOString();
const sequenceId = (prefix: string, n: number) =>
  `0193a1b2-0000-7000-8000-${prefix}${String(n).padStart(12 - prefix.length, '0')}`;

export function createHandlers(baseUrl: string, db: MockDb = createMockDb()) {
  const url = (path: string) => `${baseUrl.replace(/\/$/, '')}${path}`;
  let seq = 1;

  const findByEmail = (email: string) =>
    [...db.users.values()].find((u) => u.user.email.toLowerCase() === email.trim().toLowerCase());

  const issueSession = (u: MockUser, isNewUser = false) => {
    seq += 1;
    const access = `mock-access-${seq}`;
    const refresh = `mock-refresh-${seq}`;
    db.accessTokens.set(access, u.user.id);
    db.refreshTokens.set(refresh, u.user.id);
    return { access_token: access, refresh_token: refresh, expires_in: 900, user: u.user, is_new_user: isNewUser };
  };

  const createUser = (
    email: string,
    password: string,
    displayName: string,
    method: 'password' | 'apple' | 'google',
  ) => {
    seq += 1;
    const u: MockUser = {
      user: {
        id: sequenceId('u', seq),
        email,
        display_name: displayName,
        country: 'RW',
        base_currency: 'RWF',
        timezone: 'Africa/Kigali',
        week_starts_on: 1,
        currencies: [],
        sign_in_methods: [method],
        email_verified: method !== 'password',
        created_at: nowIso(),
      },
      password,
      settings: defaultSettings(),
      accounts: [],
      // Every new user starts with the default categories (the backend seeds them).
      categories: makeCategories((n) => sequenceId(`c${String(seq).padStart(3, '0')}`, n), nowIso()),
      transactions: [],
      devices: [],
    };
    for (const c of u.categories) touch(db.log, c.id ?? '');
    db.users.set(u.user.id, u);
    return u;
  };

  /** 426 for old app versions. */
  const versionGuard = (request: Request) => {
    const version = request.headers.get('X-App-Version');
    return version && older(version, db.minAppVersion) ? err(426, 'upgrade_required', 'Update the app') : null;
  };

  /** The signed-in user, or an error response. */
  const authed = (request: Request): MockUser | Response => {
    const denied = versionGuard(request);
    if (denied) return denied;
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!token) return err(401, 'unauthorized', 'Missing token');
    const userId = db.accessTokens.get(token);
    const u = userId ? db.users.get(userId) : undefined;
    if (!u) return err(401, 'token_expired', 'Access token expired');
    return u;
  };
  const isResponse = (v: unknown): v is Response => v instanceof Response;

  const listAccounts = (u: MockUser) => {
    const live = u.accounts.filter((a) => !a.deleted_at && !a.archived);
    return { data: live, total: { amount: accountsTotal(live), currency: u.user.base_currency } };
  };

  return [
    http.get(
      url('/health'),
      ({ request }) => versionGuard(request) ?? HttpResponse.json({ status: 'ok', min_app_version: db.minAppVersion }),
    ),

    // ------------------------------------------------------------------ auth
    http.post(url('/auth/signup'), async ({ request }) => {
      const denied = versionGuard(request);
      if (denied) return denied;
      const body = (await request.json()) as { email?: string; password?: string; display_name?: string };
      const email = body.email?.trim() ?? '';
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
        return err(422, 'validation_failed', 'Invalid email', { email: 'Enter a valid email address' });
      if (!body.password || body.password.length < 8)
        return err(422, 'validation_failed', 'Password too short', { password: 'Use at least 8 characters' });
      if (findByEmail(email)) return err(409, 'email_taken', 'An account with this email already exists');
      const u = createUser(email, body.password, body.display_name?.trim() || email.split('@')[0]!, 'password');
      return HttpResponse.json(issueSession(u, true), { status: 201 });
    }),

    http.post(url('/auth/login'), async ({ request }) => {
      const denied = versionGuard(request);
      if (denied) return denied;
      const { email, password } = (await request.json()) as { email?: string; password?: string };
      const u = email ? findByEmail(email) : undefined;
      if (!u || !u.password || u.password !== password)
        return err(401, 'invalid_credentials', 'Email or password is wrong');
      return HttpResponse.json(issueSession(u));
    }),

    ...(['apple', 'google'] as const).map((provider) =>
      http.post(url(`/auth/${provider}`), async ({ request }) => {
        const denied = versionGuard(request);
        if (denied) return denied;
        const body = (await request.json()) as { identity_token?: string; id_token?: string };
        if (!(body.identity_token ?? body.id_token)) return err(401, 'invalid_credentials', 'Missing provider token');
        // The mock trusts any provider token and maps it to one user per provider.
        const email = `${provider}.user@example.com`;
        const existing = findByEmail(email);
        const u = existing ?? createUser(email, '', provider === 'apple' ? 'Apple user' : 'Google user', provider);
        return HttpResponse.json(issueSession(u, !existing));
      }),
    ),

    http.post(url('/auth/refresh'), async ({ request }) => {
      const denied = versionGuard(request);
      if (denied) return denied;
      const { refresh_token } = (await request.json()) as { refresh_token?: string };
      const userId = refresh_token ? db.refreshTokens.get(refresh_token) : undefined;
      const u = userId ? db.users.get(userId) : undefined;
      if (!refresh_token || !u) {
        // Reusing a revoked refresh token revokes every session (theft detection).
        db.refreshTokens.clear();
        return err(401, 'unauthorized', 'Refresh token revoked');
      }
      db.refreshTokens.delete(refresh_token);
      return HttpResponse.json(issueSession(u));
    }),

    http.post(url('/auth/logout'), async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { refresh_token?: string };
      if (body.refresh_token) db.refreshTokens.delete(body.refresh_token);
      const token = request.headers.get('Authorization')?.replace(/^Bearer /, '');
      if (token) db.accessTokens.delete(token);
      return new HttpResponse(null, { status: 204 });
    }),

    http.post(url('/auth/password/forgot'), () => new HttpResponse(null, { status: 204 })),

    http.post(url('/auth/password/reset'), async ({ request }) => {
      const { token, password } = (await request.json()) as { token?: string; password?: string };
      if (token !== DEMO_RESET_TOKEN) return err(410, 'link_expired', 'This reset link has expired');
      if (!password || password.length < 8)
        return err(422, 'validation_failed', 'Password too short', { password: 'Use at least 8 characters' });
      const u = findByEmail(DEMO_EMAIL);
      if (u) u.password = password;
      return new HttpResponse(null, { status: 204 });
    }),

    http.post(url('/auth/verify-password'), async ({ request }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const { password } = (await request.json()) as { password?: string };
      if (!u.password || password !== u.password) return err(401, 'invalid_credentials', 'Password is wrong');
      return new HttpResponse(null, { status: 204 });
    }),

    // ------------------------------------------------------------------ me
    http.get(url('/me'), ({ request }) => {
      const u = authed(request);
      return isResponse(u) ? u : HttpResponse.json(u.user);
    }),

    http.patch(url('/me'), async ({ request }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const patch = (await request.json()) as UserInput;
      u.user = { ...u.user, ...patch };
      return HttpResponse.json(u.user);
    }),

    http.get(url('/me/settings'), ({ request }) => {
      const u = authed(request);
      return isResponse(u) ? u : HttpResponse.json(u.settings);
    }),

    http.patch(url('/me/settings'), async ({ request }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const patch = (await request.json()) as SettingsInput;
      u.settings = { ...u.settings, ...patch, version: u.settings.version + 1 };
      return HttpResponse.json(u.settings);
    }),

    http.post(url('/me/devices'), async ({ request }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const device = { ...((await request.json()) as Device), last_seen_at: nowIso() };
      u.devices = [...u.devices.filter((d) => d.id !== device.id), device];
      return HttpResponse.json(device);
    }),

    // ------------------------------------------------------------------ accounts
    http.get(url('/accounts'), ({ request }) => {
      const u = authed(request);
      return isResponse(u) ? u : HttpResponse.json(listAccounts(u));
    }),

    http.post(url('/accounts'), async ({ request }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const input = (await request.json()) as AccountInput;
      const existing = u.accounts.find((a) => a.id === input.id);
      if (existing) return HttpResponse.json(existing, { status: 200 });
      if (!input.id || !input.type || !input.name?.trim() || !input.currency) {
        return err(422, 'validation_failed', 'id, type, name and currency are required', {
          ...(!input.name?.trim() ? { name: 'Enter a name' } : {}),
        });
      }
      const opening = input.opening_balance ?? 0;
      const now = nowIso();
      const account: Account = {
        include_in_total: true,
        archived: false,
        sort_order: u.accounts.length,
        opening_date: now.slice(0, 10),
        ...input,
        id: input.id,
        type: input.type,
        name: input.name.trim(),
        currency: input.currency,
        opening_balance: opening,
        balance: opening,
        // The mock has no FX rates: other currencies count 1:1 in the base currency.
        balance_base: opening,
        last_reported_balance: null,
        pending_count: 0,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 1,
      };
      u.accounts.push(account);
      touch(db.log, account.id!);
      return HttpResponse.json(account, { status: 201 });
    }),

    http.get(url('/accounts/:id'), ({ request, params }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const a = u.accounts.find((x) => x.id === params.id && !x.deleted_at);
      return a ? HttpResponse.json(a) : err(404, 'not_found', 'Account not found');
    }),

    http.patch(url('/accounts/:id'), async ({ request, params }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const a = u.accounts.find((x) => x.id === params.id && !x.deleted_at);
      if (!a) return err(404, 'not_found', 'Account not found');
      const ifMatch = request.headers.get('If-Match');
      if (ifMatch && Number(ifMatch) !== a.version)
        return HttpResponse.json(
          { error: { code: 'version_conflict', message: 'Changed on another device', server_row: a } },
          { status: 409 },
        );
      const patch = (await request.json()) as AccountInput;
      const delta = patch.opening_balance !== undefined ? patch.opening_balance - (a.opening_balance ?? 0) : 0;
      Object.assign(a, patch, {
        id: a.id,
        balance: a.balance + delta,
        balance_base: a.balance_base + delta,
        updated_at: nowIso(),
        version: a.version + 1,
      });
      touch(db.log, a.id!);
      return HttpResponse.json(a);
    }),

    http.delete(url('/accounts/:id'), ({ request, params }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const a = u.accounts.find((x) => x.id === params.id && !x.deleted_at);
      if (!a) return err(404, 'not_found', 'Account not found');
      Object.assign(a, { deleted_at: nowIso(), version: a.version + 1 });
      touch(db.log, a.id!);
      return new HttpResponse(null, { status: 204 });
    }),

    // ------------------------------------------------------------------ transactions
    http.get(url('/transactions'), ({ request }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const data = [...u.transactions]
        .filter((t) => !t.deleted_at)
        .sort((a, b) => (b.occurred_at ?? '').localeCompare(a.occurred_at ?? ''));
      return HttpResponse.json({ data, next_cursor: null });
    }),

    http.post(url('/transactions'), async ({ request }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const input = (await request.json()) as TransactionInput;
      const existing = u.transactions.find((t) => t.id === input.id);
      if (existing) return HttpResponse.json({ transaction: existing }, { status: 200 });
      if (!input.id) return err(422, 'validation_failed', 'id is required', { id: 'required' });
      // Same rules as a pushed row (balances, defaults, validation).
      const result = push(db.log, u, [
        { table: 'transactions', op: 'upsert', row: { ...input, id: input.id, client_updated_at: nowIso() } },
      ]);
      const rejected = result.rejected[0];
      if (rejected) return err(422, 'validation_failed', rejected.message, { amount: 'must be greater than 0' });
      return HttpResponse.json({ transaction: u.transactions.find((t) => t.id === input.id) }, { status: 201 });
    }),

    // ------------------------------------------------------------------ categories
    http.get(url('/categories'), ({ request }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      return HttpResponse.json({ data: u.categories.filter((c) => !c.deleted_at), next_cursor: null });
    }),

    // ------------------------------------------------------------------ sync
    http.get(url('/sync/pull'), ({ request }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const q = new URL(request.url).searchParams;
      const since = Number(q.get('since') ?? 0) || 0;
      const limit = Math.min(Number(q.get('limit') ?? 500) || 500, 2000);
      return HttpResponse.json(pull(db.log, u, since, limit));
    }),

    http.post(url('/sync/push'), async ({ request }) => {
      const u = authed(request);
      if (isResponse(u)) return u;
      const body = (await request.json()) as {
        changes?: { table: SyncTable; op: 'upsert' | 'delete'; row: { id: string; client_updated_at: string } }[];
      };
      if (!Array.isArray(body.changes) || body.changes.length < 1 || body.changes.length > 500)
        return err(422, 'validation_failed', 'changes: 1 to 500 items');
      return HttpResponse.json(push(db.log, u, body.changes));
    }),
  ];
}
