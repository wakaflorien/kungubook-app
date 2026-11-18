import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createMockServer, kezaOf, seed } from '../../../mocks/node';
import { ApiError, createApiClient, unwrap } from '../../api';
import { memoryStore } from '../storage';
import { authErrorMessage, createAuthService } from './auth-service';
import { persistentTokenStore, TOKENS_KEY } from './token-store';

const { server, db, baseUrl } = createMockServer();
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function setup() {
  const kv = memoryStore();
  const tokens = persistentTokenStore(kv);
  const onSignedOut = vi.fn<() => void>();
  const api = createApiClient({ baseUrl, appVersion: '0.1.0', platform: 'ios', tokens, onSignedOut });
  return { kv, tokens, api, auth: createAuthService(api, tokens), onSignedOut };
}

describe('auth service', () => {
  it('signs up a new user, stores the tokens and starts with no accounts', async () => {
    const { auth, api, kv, tokens } = setup();
    const session = await auth.signUp({ email: 'new.user@example.com', password: 'long-enough-1', displayName: 'Ama' });

    expect(session.is_new_user).toBe(true);
    expect(session.user.display_name).toBe('Ama');
    expect(await tokens.get()).toEqual({ accessToken: session.access_token, refreshToken: session.refresh_token });
    expect(JSON.parse(kv.dump()[TOKENS_KEY]!)).toEqual({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    });
    const accounts = await unwrap(api.GET('/accounts'));
    expect(accounts.data).toHaveLength(0);
    expect(accounts.total.amount).toBe(0);
  });

  it('rejects a taken email and a short password with clear messages', async () => {
    const { auth } = setup();
    const taken = await auth.signUp({ email: seed.DEMO_EMAIL, password: 'whatever-123' }).catch((e: unknown) => e);
    expect(taken).toMatchObject({ code: 'email_taken', status: 409 });
    expect(authErrorMessage(taken)).toMatch(/already exists/);

    const short = await auth.signUp({ email: 'short@example.com', password: 'short' }).catch((e: unknown) => e);
    expect(short).toMatchObject({ code: 'validation_failed', status: 422 });
    expect(authErrorMessage(short)).toBe('Use at least 8 characters');
  });

  it('signs in with email and password, and explains a wrong password', async () => {
    const { auth, tokens } = setup();
    const wrong = await auth.signIn(seed.DEMO_EMAIL, 'nope-nope').catch((e: unknown) => e);
    expect(wrong).toBeInstanceOf(ApiError);
    expect(authErrorMessage(wrong)).toBe("That password doesn't match. Try again or reset it.");
    expect(await tokens.get()).toBeNull();

    const session = await auth.signIn(` ${seed.DEMO_EMAIL} `, seed.DEMO_PASSWORD);
    expect(session.user.email).toBe(seed.DEMO_EMAIL);
    expect(await tokens.get()).not.toBeNull();
  });

  it('passes Apple and Google tokens to the API', async () => {
    const { auth } = setup();
    expect((await auth.signInWithApple('apple-identity-token')).user.sign_in_methods).toContain('apple');
    expect((await auth.signInWithGoogle('google-id-token')).user.sign_in_methods).toContain('google');
  });

  it('verifies the password for Forgot PIN', async () => {
    const { auth } = setup();
    await auth.signIn(seed.DEMO_EMAIL, seed.DEMO_PASSWORD);
    expect(await auth.verifyPassword('wrong-password')).toBe(false);
    expect(await auth.verifyPassword(seed.DEMO_PASSWORD)).toBe(true);
  });

  it('sends reset links and resets the password with a valid token only', async () => {
    const { auth } = setup();
    await expect(auth.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
    await expect(auth.resetPassword('expired', 'new-password-1')).rejects.toMatchObject({ code: 'link_expired' });

    await auth.resetPassword(seed.DEMO_RESET_TOKEN, 'new-password-1');
    await expect(auth.signIn(seed.DEMO_EMAIL, 'new-password-1')).resolves.toBeDefined();
    kezaOf(db).password = seed.DEMO_PASSWORD; // restore for other tests
  });

  it('signs out: revokes the refresh token and forgets the tokens', async () => {
    const { auth, tokens } = setup();
    const session = await auth.signIn(seed.DEMO_EMAIL, seed.DEMO_PASSWORD);
    await auth.signOut();

    expect(await tokens.get()).toBeNull();
    expect(db.refreshTokens.has(session.refresh_token)).toBe(false);
  });

  it('still signs out locally when the server cannot be reached', async () => {
    const { auth, tokens } = setup();
    await tokens.set({ accessToken: 'a', refreshToken: 'r' });
    const { http, HttpResponse } = await import('msw');
    server.use(http.post(`${baseUrl}/auth/logout`, () => HttpResponse.error()));
    await auth.signOut();
    expect(await tokens.get()).toBeNull();
  });
});

describe('persisted tokens with the API client', () => {
  it('rotates the stored pair on 401 token_expired and keeps the user signed in', async () => {
    const { auth, api, kv, onSignedOut } = setup();
    const first = await auth.signIn(seed.DEMO_EMAIL, seed.DEMO_PASSWORD);
    db.accessTokens.delete(first.access_token); // expire the access token

    const accounts = await unwrap(api.GET('/accounts'));
    expect(accounts.total.amount).toBe(3_480_000);
    const stored = JSON.parse(kv.dump()[TOKENS_KEY]!) as { refreshToken: string };
    expect(stored.refreshToken).not.toBe(first.refresh_token);
    expect(db.refreshTokens.has(first.refresh_token)).toBe(false);
    expect(onSignedOut).not.toHaveBeenCalled();
  });

  it('signs out and wipes the stored tokens when the refresh is refused', async () => {
    const { auth, api, kv, onSignedOut } = setup();
    const first = await auth.signIn(seed.DEMO_EMAIL, seed.DEMO_PASSWORD);
    db.accessTokens.delete(first.access_token);
    db.refreshTokens.delete(first.refresh_token);

    await expect(unwrap(api.GET('/accounts'))).rejects.toMatchObject({ code: 'token_expired' });
    expect(onSignedOut).toHaveBeenCalledOnce();
    expect(kv.dump()[TOKENS_KEY]).toBeUndefined();
  });

  it('loads tokens saved by an earlier app run', async () => {
    const kv = memoryStore({ [TOKENS_KEY]: JSON.stringify({ accessToken: 'mock-access-1', refreshToken: 'x' }) });
    db.accessTokens.set('mock-access-1', kezaOf(db).user.id);
    const tokens = persistentTokenStore(kv);
    const api = createApiClient({ baseUrl, appVersion: '0.1.0', platform: 'ios', tokens });
    expect((await unwrap(api.GET('/me'))).email).toBe(seed.DEMO_EMAIL);
  });
});

describe('M1 done-check against the stateful mock', () => {
  it('a new user signs up, adds 3 accounts and gets the total from the API', async () => {
    const { auth, api } = setup();
    await auth.signUp({ email: 'done.check@example.com', password: 'long-enough-1', displayName: 'Keza Uwase' });
    await unwrap(api.PATCH('/me', { body: { base_currency: 'RWF', country: 'RW' } }));

    const { newId } = await import('../id');
    const ids = [newId(), newId(), newId()];
    const rows = [
      {
        id: ids[0]!,
        type: 'mobile_money' as const,
        provider: 'mtn_momo' as const,
        name: 'MTN MoMo',
        opening_balance: 412_400,
      },
      {
        id: ids[1]!,
        type: 'mobile_money' as const,
        provider: 'airtel_money' as const,
        name: 'Airtel Money',
        opening_balance: 145_000,
      },
      { id: ids[2]!, type: 'cash' as const, provider: 'cash' as const, name: 'Cash', opening_balance: 62_600 },
    ];
    for (const r of rows) await unwrap(api.POST('/accounts', { body: { ...r, currency: 'RWF' } }));
    // A retried POST with the same id doesn't create a fourth account.
    await unwrap(api.POST('/accounts', { body: { ...rows[0]!, currency: 'RWF' } }));

    const list = await unwrap(api.GET('/accounts'));
    expect(list.data).toHaveLength(3);
    expect(list.total).toEqual({ amount: 620_000, currency: 'RWF' });

    // Editing the opening balance moves the balance; a stale If-Match is refused.
    const momo = list.data.find((a) => a.id === ids[0])!;
    const edited = await unwrap(
      api.PATCH('/accounts/{id}', {
        params: { path: { id: momo.id! }, header: { 'If-Match': momo.version } },
        body: { opening_balance: 500_000, name: 'MoMo main line' },
      }),
    );
    expect(edited).toMatchObject({ balance: 500_000, name: 'MoMo main line', version: momo.version + 1 });
    await expect(
      unwrap(
        api.PATCH('/accounts/{id}', {
          params: { path: { id: momo.id! }, header: { 'If-Match': momo.version } },
          body: { name: 'Stale' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'version_conflict', status: 409 });
    expect((await unwrap(api.GET('/accounts'))).total.amount).toBe(707_600);
  });

  it('registers the device for push', async () => {
    const { auth, api } = setup();
    await auth.signIn(seed.DEMO_EMAIL, seed.DEMO_PASSWORD);
    const device = await unwrap(
      api.POST('/me/devices', {
        body: { id: '0193a1b2-0000-7000-8000-00000000d001', platform: 'ios', app_version: '0.1.0' },
      }),
    );
    expect(device.last_seen_at).toBeDefined();
    expect(kezaOf(db).devices).toHaveLength(1);
  });
});
