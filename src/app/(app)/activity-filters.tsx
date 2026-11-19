import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useAccounts } from '../../features/accounts/useAccounts';
import {
  DEFAULT_FILTERS,
  toQuery,
  useActivityFilters,
  useTransactionTotals,
  type ActivityFilters,
  type Direction,
} from '../../features/transactions/useTransactions';
import type { TxnSource, TxnStatus } from '../../db/repositories';
import type { Period } from '../../lib/ledger';
import { useTheme } from '../../theme';
import { Button, Chip, Sheet, Text } from '../../ui';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];
const DIRECTIONS: { value: Direction; label: string }[] = [
  { value: 'in', label: 'Money in' },
  { value: 'out', label: 'Money out' },
  { value: 'transfer', label: 'Transfers' },
];
const SOURCES: { value: TxnSource; label: string }[] = [
  { value: 'sms', label: 'SMS' },
  { value: 'shortcut', label: 'Shortcut' },
  { value: 'import', label: 'Import' },
  { value: 'email', label: 'Email' },
  { value: 'manual', label: 'Manual' },
];
const STATUSES: { value: TxnStatus; label: string }[] = [
  { value: 'pending_review', label: 'Needs review' },
  { value: 'confirmed', label: 'Confirmed' },
];

const toggle = <T,>(list: readonly T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Group({ title, children }: { title: string; children: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.s2 }}>
      <Text variant="label" color="ink2" accessibilityRole="header">
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.s2 }}>{children}</View>
    </View>
  );
}

/** Screen 04 · Activity filters (sheet). Changes apply when you tap "Show N transactions". */
export default function ActivityFiltersSheet() {
  const t = useTheme();
  const router = useRouter();
  const current = useActivityFilters();
  const [draft, setDraft] = useState<ActivityFilters>(() => ({
    period: current.period,
    directions: current.directions,
    accountIds: current.accountIds,
    sources: current.sources,
    statuses: current.statuses,
    q: current.q,
  }));
  const accounts = useAccounts().data?.data ?? [];
  const count = useTransactionTotals(toQuery(draft)).data?.count;
  const patch = (p: Partial<ActivityFilters>) => setDraft((d) => ({ ...d, ...p }));

  const apply = () => {
    current.set(draft);
    router.back();
  };

  return (
    <Sheet
      title="Filter activity"
      onClose={() => router.back()}
      footer={
        <Button
          block
          label={
            count === undefined ? 'Show transactions' : `Show ${count} ${count === 1 ? 'transaction' : 'transactions'}`
          }
          onPress={apply}
        />
      }
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => setDraft({ ...DEFAULT_FILTERS, q: draft.q })}
        style={{ alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center', marginTop: -t.space.s3 }}
      >
        <Text variant="row" color="brand" style={{ fontFamily: t.type.title3.fontFamily }}>
          Reset
        </Text>
      </Pressable>
      <Group title="Period">
        {PERIODS.map((p) => (
          <Chip
            key={p.value}
            label={p.label}
            selected={draft.period === p.value}
            onPress={() => patch({ period: p.value })}
          />
        ))}
      </Group>
      <Group title="Direction">
        {DIRECTIONS.map((d) => (
          <Chip
            key={d.value}
            label={d.label}
            selected={draft.directions.includes(d.value)}
            onPress={() => patch({ directions: toggle(draft.directions, d.value) })}
          />
        ))}
      </Group>
      <Group title="Account">
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name ?? 'Account'}
            selected={draft.accountIds.includes(a.id)}
            onPress={() => patch({ accountIds: toggle(draft.accountIds, a.id) })}
          />
        ))}
      </Group>
      <Group title="Source">
        {SOURCES.map((s) => (
          <Chip
            key={s.value}
            label={s.label}
            selected={draft.sources.includes(s.value)}
            onPress={() => patch({ sources: toggle(draft.sources, s.value) })}
          />
        ))}
      </Group>
      <Group title="Status">
        {STATUSES.map((s) => (
          <Chip
            key={s.value}
            label={s.label}
            selected={draft.statuses.includes(s.value)}
            onPress={() => patch({ statuses: toggle(draft.statuses, s.value) })}
          />
        ))}
      </Group>
    </Sheet>
  );
}
