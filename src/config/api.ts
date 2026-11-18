import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api';
import { createApiClient } from '../api/client';
import { createAuthService } from '../lib/auth/auth-service';
import { persistentTokenStore } from '../lib/auth/token-store';
import { createPinLock } from '../lib/security/pin-lock';
import { createCache } from '../platform/db';
import { secureStore } from '../platform/secure-store';
import { env } from './env';

/** App-wide services. Screens use these through hooks, never `fetch` directly. */
export const kv = secureStore;
export const tokenStore = persistentTokenStore(kv);
export const pinLock = createPinLock(kv);
export const cache = createCache(kv);

/** Set by the session store: what to do when the API ends the session or demands an update. */
export const apiEvents = {
  onSignedOut: () => {},
  onUpgradeRequired: () => {},
};

export const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  appVersion: env.appVersion,
  platform: env.platform,
  tokens: tokenStore,
  onSignedOut: () => apiEvents.onSignedOut(),
  onUpgradeRequired: () => apiEvents.onUpgradeRequired(),
});

export const auth = createAuthService(api, tokenStore);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retry network blips, never auth, validation or upgrade errors.
      retry: (count, err) => count < 2 && (!(err instanceof ApiError) || err.code === 'network' || err.status >= 500),
    },
  },
});
