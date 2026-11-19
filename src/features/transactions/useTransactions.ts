import { create } from 'zustand';
import { repos } from '../../config/data';
import type {
  SplitPart,
  TransactionDraft,
  TransactionFilter,
  TransferDraft,
  TxnKind,
  TxnSource,
  TxnStatus,
} from '../../db/repositories';
import { dayKey, periodRange, type Period } from '../../lib/ledger';
import { useLocalMutation, useLocalQuery } from '../sync/useLocalQuery';

export type Direction = 'in' | 'out' | 'transfer';

/** Activity filters (screen 04). Kept while the app is open; "Reset" clears them. */
export interface ActivityFilters {
  period: Period;
  directions: Direction[];
  accountIds: string[];
  sources: TxnSource[];
  statuses: TxnStatus[];
  q: string;
}

export const DEFAULT_FILTERS: ActivityFilters = {
  period: 'month',
  directions: [],
  accountIds: [],
  sources: [],
  statuses: [],
  q: '',
};

export const useActivityFilters = create<
  ActivityFilters & { set: (patch: Partial<ActivityFilters>) => void; reset: () => void }
>()((set) => ({ ...DEFAULT_FILTERS, set: (patch) => set(patch), reset: () => set(DEFAULT_FILTERS) }));

/** How many filters differ from the defaults (shown on the Filters chip). */
export const activeFilterCount = (f: ActivityFilters) =>
  (f.period !== DEFAULT_FILTERS.period ? 1 : 0) +
  (f.directions.length ? 1 : 0) +
  (f.accountIds.length ? 1 : 0) +
  (f.sources.length ? 1 : 0) +
  (f.statuses.length ? 1 : 0);

export const today = () => dayKey(new Date().toISOString());

export function toQuery(f: ActivityFilters): TransactionFilter {
  return {
    ...periodRange(f.period, today()),
    directions: f.directions,
    accountIds: f.accountIds,
    sources: f.sources,
    statuses: f.statuses,
    q: f.q,
  };
}

export const useTransactions = (f: TransactionFilter) =>
  useLocalQuery(['transactions', f], () => repos.transactions.list(f));

export const useTransactionTotals = (f: TransactionFilter) =>
  useLocalQuery(['totals', f], () => repos.transactions.totals(f));

export const useTransaction = (id: string) => useLocalQuery(['transaction', id], () => repos.transactions.get(id));

export const useCategories = (direction?: TxnKind) =>
  useLocalQuery(['categories', direction ?? 'all'], () => repos.categories.list(direction));

export const useCreateTransaction = () => useLocalMutation((d: TransactionDraft) => repos.transactions.create(d));
export const useUpdateTransaction = () =>
  useLocalMutation(({ id, patch }: { id: string; patch: Partial<TransactionDraft> }) =>
    repos.transactions.update(id, patch),
  );
export const useRemoveTransaction = () => useLocalMutation((id: string) => repos.transactions.remove(id));
export const useConfirmTransaction = () => useLocalMutation((id: string) => repos.transactions.confirm(id));
export const useCreateTransfer = () => useLocalMutation((d: TransferDraft) => repos.transactions.createTransfer(d));
export const useUpdateTransfer = () =>
  useLocalMutation(({ group, draft }: { group: string; draft: TransferDraft }) =>
    repos.transactions.updateTransfer(group, draft),
  );
export const useSplit = () =>
  useLocalMutation(({ id, parts }: { id: string; parts: SplitPart[] }) => repos.transactions.split(id, parts));
