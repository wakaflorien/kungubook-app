import { getRandomBytes } from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import type { KeyValueStore } from '../lib/storage';

/**
 * The local cache: SQLite encrypted with SQLCipher (TRD §8). The 256-bit key is generated on first use
 * and kept in secure storage. SQLCipher needs a development or store build (`useSQLCipher` in app.config.ts);
 * in Expo Go `PRAGMA key` is ignored and the cache is plain SQLite, which `isEncrypted()` reports.
 *
 * M1 caches API responses by key (accounts, the user) so Home shows figures instantly on a cold start.
 * The full offline repositories and sync engine arrive in M2.
 */
const DB_NAME = 'kungubook.db';
const DB_KEY = 'db.key';

let opening: Promise<SQLite.SQLiteDatabase> | null = null;
let encrypted = false;

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

async function databaseKey(store: KeyValueStore): Promise<string> {
  const existing = await store.getItem(DB_KEY);
  if (existing) return existing;
  const key = toHex(getRandomBytes(32));
  await store.setItem(DB_KEY, key);
  return key;
}

async function open(store: KeyValueStore) {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  // A raw hex key ("x'…'") skips SQLCipher's own key derivation; it must run before anything else.
  await db.execAsync(`PRAGMA key = "x'${await databaseKey(store)}'";`);
  const cipher = await db.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version;').catch(() => null);
  encrypted = !!cipher?.cipher_version;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS cache (
      key TEXT PRIMARY KEY NOT NULL,
      json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  return db;
}

export function database(store: KeyValueStore) {
  opening ??= open(store).catch((e: unknown) => {
    opening = null;
    throw e;
  });
  return opening;
}

export const isEncrypted = () => encrypted;

export function createCache(store: KeyValueStore) {
  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        const db = await database(store);
        const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM cache WHERE key = ?', key);
        return row ? (JSON.parse(row.json) as T) : null;
      } catch {
        return null; // A cache miss never breaks a screen.
      }
    },
    async set(key: string, value: unknown) {
      try {
        const db = await database(store);
        await db.runAsync(
          'INSERT OR REPLACE INTO cache (key, json, updated_at) VALUES (?, ?, ?)',
          key,
          JSON.stringify(value),
          Date.now(),
        );
      } catch {
        // Ignore: the API stays the source of truth.
      }
    },
    /** Sign-out: delete the database file and its key. */
    async wipe() {
      try {
        const db = await opening;
        await db?.closeAsync();
      } catch {
        // already closed
      }
      opening = null;
      await SQLite.deleteDatabaseAsync(DB_NAME).catch(() => undefined);
      await store.deleteItem(DB_KEY);
    },
  };
}

export type Cache = ReturnType<typeof createCache>;
