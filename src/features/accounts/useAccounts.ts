import type { components } from '../../api';
import { repos, syncEngine } from '../../config/data';
import type { Acct } from '../../db/repositories';
import { useLocalMutation, useLocalQuery, useRefresh, useSyncStatus } from '../sync/useLocalQuery';

type AccountInput = components['schemas']['AccountInput'];
export type AccountList = { data: Acct[]; total: components['schemas']['Money'] };

/**
 * Accounts from the local database (M2): balances are the last synced balances plus changes made on this phone
 * that haven't synced yet, so Home updates the moment something is saved, even offline.
 * Before the first sync on this phone there's nothing to show yet: `isPending` (or `isError` if it failed).
 */
export function useAccounts() {
  const q = useLocalQuery(['accounts'], async () => {
    const [data, total, synced] = await Promise.all([
      repos.accounts.list(),
      repos.accounts.total(),
      syncEngine.hasSynced(),
    ]);
    return { list: { data, total } as AccountList, synced };
  });
  const sync = useSyncStatus();
  const { refreshing, refresh } = useRefresh();
  const waiting = !!q.data && !q.data.synced && q.data.list.data.length === 0;
  const failed = waiting && (sync.phase === 'offline' || sync.phase === 'error');
  return {
    data: q.data && !waiting ? q.data.list : undefined,
    isPending: q.isPending || (waiting && !failed),
    isError: failed,
    error: sync.error ?? new Error('Not synced yet'),
    refetch: refresh,
    isRefetching: refreshing,
  };
}

export function useAccount(id: string) {
  const q = useLocalQuery(['account', id], () => repos.accounts.get(id));
  return { data: q.data ?? undefined, isError: q.isSuccess && !q.data, isPending: q.isPending };
}

export function useCreateAccount() {
  return useLocalMutation((body: AccountInput & { id?: string; type: Acct['type']; name: string; currency: string }) =>
    repos.accounts.create(body),
  );
}

export function useUpdateAccount(id: string) {
  // `version` is kept on the stored row and sent with the push (last write wins on the server).
  return useLocalMutation(({ version: _version, ...body }: AccountInput & { version?: number }) =>
    repos.accounts.update(id, body),
  );
}
