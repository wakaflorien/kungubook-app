import createClient, { type Client, type Middleware } from 'openapi-fetch';
import { ApiError, toApiError } from './errors';
import type { components, paths } from './schema';

export type Session = components['schemas']['Session'];

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Where tokens live. M0 keeps them in memory; M1 moves them to expo-secure-store. */
export interface TokenStore {
  get(): Promise<TokenPair | null>;
  set(tokens: TokenPair): Promise<void>;
  clear(): Promise<void>;
}

export function memoryTokenStore(initial: TokenPair | null = null): TokenStore {
  let tokens = initial;
  return {
    get: async () => tokens,
    set: async (t) => {
      tokens = t;
    },
    clear: async () => {
      tokens = null;
    },
  };
}

export interface ApiClientOptions {
  /** e.g. `http://localhost:4010` (Prism) or `https://api.kungubook.app/v1`. */
  baseUrl: string;
  /** Sent as `X-App-Version: <appVersion> (<platform>)`. */
  appVersion: string;
  platform: string;
  tokens: TokenStore;
  /** Refresh failed or was refused: the user must sign in again. */
  onSignedOut?: () => void;
  /** The API answered 426: show the "update the app" screen. */
  onUpgradeRequired?: () => void;
}

export type KunguBookClient = Client<paths>;

/** Routes that never carry the bearer token. */
const isPublicPath = (pathname: string) =>
  /\/(health|auth\/(signup|login|apple|google|refresh|password\/forgot|password\/reset))$/.test(pathname);

async function readErrorCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.clone().json()) as { error?: { code?: string } };
    return body?.error?.code;
  } catch {
    return undefined;
  }
}

/**
 * The typed KunguBook API client: openapi-fetch plus
 * - `Authorization: Bearer` on every route except `/auth/*` and `/health`,
 * - `X-App-Version`,
 * - one refresh-and-retry on `401 token_expired` (refresh tokens rotate; concurrent requests share one refresh),
 * - `426` → `onUpgradeRequired`.
 * Use `unwrap()` to turn `{ error }` results into a thrown `ApiError`.
 */
export function createApiClient(options: ApiClientOptions): KunguBookClient {
  const { baseUrl, tokens, onSignedOut, onUpgradeRequired } = options;
  const appVersionHeader = `${options.appVersion} (${options.platform})`;
  const doFetch = (input: Request) => globalThis.fetch(input);

  // Keep a pristine copy of each outgoing request so it can be replayed after a refresh.
  const pending = new Map<string, Request>();
  let refreshing: Promise<string | null> | null = null;

  async function refresh(): Promise<string | null> {
    const current = await tokens.get();
    if (!current?.refreshToken) return null;
    try {
      const res = await doFetch(
        new Request(`${baseUrl.replace(/\/$/, '')}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-App-Version': appVersionHeader },
          body: JSON.stringify({ refresh_token: current.refreshToken }),
        }),
      );
      if (!res.ok) return null;
      const session = (await res.json()) as Session;
      await tokens.set({ accessToken: session.access_token, refreshToken: session.refresh_token });
      return session.access_token;
    } catch {
      return null;
    }
  }

  /** One refresh at a time; everyone waiting gets the same new access token. */
  function refreshOnce(): Promise<string | null> {
    refreshing ??= refresh().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  const middleware: Middleware = {
    async onRequest({ request, id }) {
      request.headers.set('X-App-Version', appVersionHeader);
      if (!isPublicPath(new URL(request.url).pathname)) {
        const t = await tokens.get();
        if (t?.accessToken) request.headers.set('Authorization', `Bearer ${t.accessToken}`);
      }
      pending.set(id, request.clone());
      return request;
    },

    // Return undefined to keep the response as is; return a Response only when replacing it.
    async onResponse({ response, id }) {
      const original = pending.get(id);
      pending.delete(id);

      if (response.status === 426) {
        onUpgradeRequired?.();
        return undefined;
      }
      if (response.status !== 401 || !original) return undefined;
      if (isPublicPath(new URL(original.url).pathname)) return undefined;
      if ((await readErrorCode(response)) !== 'token_expired') return undefined;

      const accessToken = await refreshOnce();
      if (!accessToken) {
        await tokens.clear();
        onSignedOut?.();
        return undefined;
      }
      const retry = original.clone();
      retry.headers.set('Authorization', `Bearer ${accessToken}`);
      const retried = await doFetch(retry);
      if (retried.status === 426) onUpgradeRequired?.();
      // Rebuild with the global Response: on React Native, fetch's responses are not
      // `instanceof Response`, which openapi-fetch requires for a replaced response.
      return new Response(await retried.text(), {
        status: retried.status,
        statusText: retried.statusText,
        headers: retried.headers,
      });
    },

    onError({ id }) {
      pending.delete(id);
    },
  };

  const client = createClient<paths>({ baseUrl, fetch: doFetch });
  client.use(middleware);
  return client;
}

/**
 * Return `data`, or throw the typed error. For TanStack Query:
 * `queryFn: () => unwrap(api.GET('/accounts'))`.
 */
export async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  let result: { data?: T; error?: unknown; response: Response };
  try {
    result = await call;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError({ code: 'network', status: 0, message: err instanceof Error ? err.message : String(err) });
  }
  const { data, error, response } = result;
  if (!response.ok || error !== undefined) throw toApiError(response.status, error);
  return data as T;
}
