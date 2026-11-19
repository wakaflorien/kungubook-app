import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AFTER_WRITE_MS, LOCAL, requestSync, syncNow, useSyncStatus } from '../../config/data';

/**
 * Reads from the local database. It re-runs whenever anything is written locally (a save on this phone or
 * rows a sync brought in), so screens never go stale and never wait for the network.
 */
export function useLocalQuery<T>(key: readonly unknown[], read: () => Promise<T>) {
  return useQuery({ queryKey: [LOCAL, ...key], queryFn: read, staleTime: Infinity, networkMode: 'always' });
}

/** A local write, followed by a sync 2 s later (more edits in that time go in the same push). */
export function useLocalMutation<A, R>(write: (args: A) => Promise<R>) {
  return useMutation({
    mutationFn: write,
    networkMode: 'always',
    onSuccess: () => requestSync(AFTER_WRITE_MS),
  });
}

/** Pull to refresh: sync now; the spinner shows only for this manual sync, not the background ones. */
export function useRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  return {
    refreshing,
    refresh: async () => {
      setRefreshing(true);
      try {
        await syncNow();
      } catch {
        // The sync status (offline or error) explains it on screen.
      } finally {
        setRefreshing(false);
      }
    },
  };
}

export { useSyncStatus };
