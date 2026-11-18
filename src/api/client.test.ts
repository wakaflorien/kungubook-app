import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockServer } from '../../mocks/node';
import { newId } from '../lib/id';
import { ApiError, UpgradeRequiredError, createApiClient, memoryTokenStore, unwrap, type TokenStore } from './index';

const { server, db, baseUrl } = createMockServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let tokens: TokenStore;
let onSignedOut: ReturnType<typeof vi.fn<() => void>>;
let onUpgradeRequired: ReturnType<typeof vi.fn<() => void>>;

const makeClient = (appVersion = '0.1.0') =>
  createApiClient({ baseUrl, appVersion, platform: 'ios', tokens, onSignedOut, onUpgradeRequired });

beforeEach(() => {
  db.accessTokens = new Set(['mock-access-1']);
  db.refreshTokens = new Set(['mock-refresh-1']);
  tokens = memoryTokenStore({ accessToken: 'mock-access-1', refreshToken: 'mock-refresh-1' });
  onSignedOut = vi.fn<() => void>();
  onUpgradeRequired = vi.fn<() => void>();
});

describe('api client', () => {
  it('sends the bearer token and X-App-Version, and returns typed data', async () => {
    const seen: Request[] = [];
    server.events.on('request:start', ({ request }) => void seen.push(request.clone()));
    const api = makeClient();
    const res = await unwrap(api.GET('/accounts'));
    server.events.removeAllListeners();

    expect(res.total).toEqual({ amount: 3_480_000, currency: 'RWF' });
    expect(res.data).toHaveLength(5);
    expect(seen[0]!.headers.get('Authorization')).toBe('Bearer mock-access-1');
    expect(seen[0]!.headers.get('X-App-Version')).toBe('0.1.0 (ios)');
  });

  it('does not send the token to /health or /auth routes', async () => {
    let auth: string | null = 'unset';
    server.use(
      http.get(`${baseUrl}/health`, ({ request }) => {
        auth = request.headers.get('Authorization');
        return HttpResponse.json({ status: 'ok' });
      }),
    );
    await unwrap(makeClient().GET('/health'));
    expect(auth).toBeNull();
  });

  it('refreshes once on 401 token_expired, rotates tokens and retries the request', async () => {
    db.accessTokens.clear(); // the stored access token has expired
    const api = makeClient();
    const res = await unwrap(api.GET('/accounts'));

    expect(res.total.amount).toBe(3_480_000);
    expect(await tokens.get()).toEqual({ accessToken: 'mock-access-2', refreshToken: 'mock-refresh-2' });
    expect(db.refreshTokens.has('mock-refresh-1')).toBe(false); // rotated
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('shares one refresh between concurrent requests', async () => {
    db.accessTokens.clear();
    let refreshCalls = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.url.endsWith('/auth/refresh')) refreshCalls += 1;
    });
    const api = makeClient();
    const results = await Promise.all([
      unwrap(api.GET('/accounts')),
      unwrap(api.GET('/transactions')),
      unwrap(api.GET('/accounts')),
    ]);
    server.events.removeAllListeners();

    expect(results).toHaveLength(3);
    expect(refreshCalls).toBe(1);
  });

  it('replays a POST body after refreshing', async () => {
    db.accessTokens.clear();
    const id = newId();
    const res = await unwrap(
      makeClient().POST('/transactions', {
        body: { id, account_id: db.accounts[4]!.id, kind: 'out', amount: 5_000, currency: 'RWF' },
      }),
    );
    expect(res.transaction.id).toBe(id);
    expect(db.accounts[4]!.balance).toBe(57_600);
  });

  it('signs out when the refresh token is refused', async () => {
    db.accessTokens.clear();
    db.refreshTokens.clear();
    const api = makeClient();

    await expect(unwrap(api.GET('/accounts'))).rejects.toMatchObject({ code: 'token_expired', status: 401 });
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(await tokens.get()).toBeNull();
  });

  it('does not retry other 401 codes', async () => {
    await tokens.clear();
    await expect(unwrap(makeClient().GET('/accounts'))).rejects.toMatchObject({ code: 'unauthorized' });
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('maps { error: { code, fields } } to a typed ApiError', async () => {
    const api = makeClient();
    const err = await unwrap(
      api.POST('/transactions', { body: { id: newId(), account_id: db.accounts[0]!.id, kind: 'out', amount: 0 } }),
    ).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'validation_failed', status: 422, fields: { amount: 'must be greater than 0' } });
  });

  it('turns 426 into UpgradeRequiredError and notifies the app', async () => {
    const api = makeClient('0.0.9');
    const err = await unwrap(api.GET('/accounts')).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(UpgradeRequiredError);
    expect(err).toMatchObject({ code: 'upgrade_required', status: 426 });
    expect(onUpgradeRequired).toHaveBeenCalledOnce();
  });

  it('reports network failures as code "network"', async () => {
    server.use(http.get(`${baseUrl}/accounts`, () => HttpResponse.error()));
    await expect(unwrap(makeClient().GET('/accounts'))).rejects.toMatchObject({ code: 'network', status: 0 });
  });

  it('remembers created transactions (stateful MSW)', async () => {
    const api = makeClient();
    const before = (await unwrap(api.GET('/transactions'))).data.length;
    const id = newId();
    await unwrap(
      api.POST('/transactions', { body: { id, account_id: db.accounts[0]!.id, kind: 'in', amount: 10_000 } }),
    );
    // A retried POST with the same id returns the existing row (200), not a second row.
    await unwrap(
      api.POST('/transactions', { body: { id, account_id: db.accounts[0]!.id, kind: 'in', amount: 10_000 } }),
    );
    const after = await unwrap(api.GET('/transactions'));

    expect(after.data).toHaveLength(before + 1);
    expect(after.data.some((t) => t.id === id)).toBe(true);
  });
});
