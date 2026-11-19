import { create } from 'zustand';
import { createRepositories } from '../db/repositories';
import { createLocalStore } from '../db/store';
import { createSyncEngine, type SyncStatus } from '../db/sync';
import { sqliteDriver } from '../platform/db';
import { api, kv, queryClient } from './api';

/**
 * Local-first data (M2): screens read the encrypted SQLite database through the repositories and write to it
 * offline; the sync engine pushes and pulls in the background (TRD §4).
 */
export const localStore = createLocalStore(sqliteDriver(kv));
export const repos = createRepositories(localStore, {});

/** Query keys for local reads start with this; any local write refreshes them. */
export const LOCAL = 'local';
localStore.subscribe(() => void queryClient.invalidateQueries({ queryKey: [LOCAL] }));

export const useSyncStatus = create<SyncStatus>()(() => ({
  phase: 'idle',
  lastSyncedAt: null,
  unsynced: 0,
  rejected: 0,
  error: null,
}));

export const syncEngine = createSyncEngine({
  store: localStore,
  api,
  onStatus: (s) => useSyncStatus.setState(s),
});

/** After a local write: wait 2 s for more edits, then sync (TRD §4). */
export const AFTER_WRITE_MS = 2_000;
/**
 * While the app is open it pulls this often, so a change made on another phone shows within ~5 s
 * (M2 done-check). A pull with nothing new is one small request. A silent push from the API (M5) can
 * replace most of this polling later.
 */
export const POLL_MS = 3_000;

let timer: ReturnType<typeof setTimeout> | null = null;

/** Syncs after `delay` ms; a newer request replaces a waiting one. Failures only update the status. */
export function requestSync(delay = 0) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    syncEngine.sync().catch(() => undefined);
  }, delay);
}

/** Sync now and wait (pull to refresh). */
export const syncNow = () => syncEngine.sync();

/** Sign-out: the database file is deleted elsewhere; forget its state here. */
export function resetLocalData() {
  if (timer) clearTimeout(timer);
  timer = null;
  localStore.reset();
  useSyncStatus.setState({ phase: 'idle', lastSyncedAt: null, unsynced: 0, rejected: 0, error: null });
}
