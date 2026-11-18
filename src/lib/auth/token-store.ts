import type { TokenPair, TokenStore } from '../../api/client';
import { getJson, setJson, type KeyValueStore } from '../storage';

export const TOKENS_KEY = 'auth.tokens';

/**
 * Tokens persisted in secure storage, with an in-memory copy so each API request
 * doesn't need a Keychain read. Refresh-token rotation writes through `set`.
 */
export function persistentTokenStore(kv: KeyValueStore): TokenStore & { load(): Promise<TokenPair | null> } {
  let cache: TokenPair | null | undefined;

  const load = async () => {
    if (cache === undefined) cache = await getJson<TokenPair>(kv, TOKENS_KEY);
    return cache;
  };

  return {
    load,
    get: load,
    async set(tokens) {
      cache = tokens;
      await setJson(kv, TOKENS_KEY, tokens);
    },
    async clear() {
      cache = null;
      await kv.deleteItem(TOKENS_KEY);
    },
  };
}
