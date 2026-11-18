import { getRandomValues } from 'expo-crypto';

/**
 * UUID v7 (`newId`) and the PIN salt need `crypto.getRandomValues`. Hermes may not provide it,
 * so fall back to expo-crypto's native secure random source. Imported first by the root layout.
 */
const g = globalThis as { crypto?: { getRandomValues?: unknown } };
if (typeof g.crypto?.getRandomValues !== 'function') {
  g.crypto = { ...(g.crypto ?? {}), getRandomValues };
}
