import { env } from './env';
import { createApiClient, memoryTokenStore } from '../api/client';

/**
 * The app's API client. M0 has no sign-in yet, so against the mock it uses a demo token
 * (Prism only checks that a bearer token is present). M1 replaces this with expo-secure-store.
 */
export const tokenStore = memoryTokenStore(
  env.appEnv === 'mock' ? { accessToken: 'mock-access-1', refreshToken: 'mock-refresh-1' } : null,
);

export const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  appVersion: env.appVersion,
  platform: env.platform,
  tokens: tokenStore,
});
