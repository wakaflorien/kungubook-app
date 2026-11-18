/**
 * A small async key-value store. On the phone it is backed by expo-secure-store (Keychain / Keystore,
 * see src/platform/secure-store.ts); in tests by memory. Keys use `[A-Za-z0-9._-]` only (SecureStore rule).
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { dump(): Record<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    deleteItem: async (k) => {
      data.delete(k);
    },
    dump: () => Object.fromEntries(data),
  };
}

export async function getJson<T>(store: KeyValueStore, key: string): Promise<T | null> {
  const raw = await store.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const setJson = (store: KeyValueStore, key: string, value: unknown) => store.setItem(key, JSON.stringify(value));
