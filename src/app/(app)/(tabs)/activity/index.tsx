import { Stack, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useAccounts } from '../../../../features/accounts/useAccounts';
import { useRefresh } from '../../../../features/sync/useLocalQuery';
import { SyncBanner } from '../../../../features/sync/SyncBanner';
import { TransactionRow, dayLabel } from '../../../../features/transactions/TransactionRow';
import {
  activeFilterCount,
  toQuery,
  useActivityFilters,
  useTransactionTotals,
  useTransactions,
} from '../../../../features/transactions/useTransactions';
import { groupByDay } from '../../../../lib/ledger';
import { useTheme } from '../../../../theme';
import { Amount, Card, Chip, EmptyState, Screen, Text } from '../../../../ui';

const PERIOD_LABEL = {
  week: 'This week',
  month: 'This month',
  last_month: 'Last month',
  year: 'This year',
  all: 'All time',
} as const;

/** Screen 02 · Activity: search, filters, the period's money in and out, and transactions grouped by day. */
export default function ActivityScreen() {
  const t = useTheme();
  const router = useRouter();
  const filters = useActivityFilters();
  const query = toQuery(filters);
  const { data: items, isPending } = useTransactions(query);
  const { data: sums } = useTransactionTotals(query);
  const accounts = useAccounts().data?.data ?? [];
  const { refreshing, refresh } = useRefresh();
  const openFilters = () => router.push('/activity-filters');

  const groups = groupByDay((items ?? []).map((i) => ({ ...i.txn, item: i })));
  const accountLabel =
    filters.accountIds.length === 1
      ? (accounts.find((a) => a.id === filters.accountIds[0])?.name ?? '1 account')
      : filters.accountIds.length
        ? `${filters.accountIds.length} accounts`
        : 'All accounts';
  const directionLabel =
    filters.directions.length === 1
      ? { in: 'Money in', out: 'Money out', transfer: 'Transfers' }[filters.directions[0]!]
      : 'In & out';
  const count = activeFilterCount(filters);
  const searching = !!filters.q.trim();

  return (
    <Screen title="Activity" refreshing={refreshing} onRefresh={() => void refresh()}>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: 'Search name, amount or note',
            hideWhenScrolling: false,
            autoCapitalize: 'none',
            onChangeText: (e) => filters.set({ q: e.nativeEvent.text }),
            onCancelButtonPress: () => filters.set({ q: '' }),
          },
        }}
      />
      <SyncBanner />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -t.space.s4, marginBottom: -t.space.s3 }}
        contentContainerStyle={{ gap: t.space.s2, paddingHorizontal: t.space.s4 }}
      >
        <Chip label="Filters" icon="tune" selected={count > 0} count={count || undefined} onPress={openFilters} />
        <Chip label={PERIOD_LABEL[filters.period]} onPress={openFilters} />
        <Chip label={accountLabel} selected={filters.accountIds.length > 0} onPress={openFilters} />
        <Chip label={directionLabel} selected={filters.directions.length > 0} onPress={openFilters} />
        <Chip
          label={filters.sources.length ? `${filters.sources.length} sources` : 'Source'}
          selected={filters.sources.length > 0}
          onPress={openFilters}
        />
      </ScrollView>

      {sums ? (
        <Card>
          <Text variant="label" color="ink2">
            {searching ? 'Matching' : filters.period === 'month' ? 'This month so far' : PERIOD_LABEL[filters.period]}
          </Text>
          <View style={{ flexDirection: 'row', gap: t.space.s5, marginTop: t.space.s2 }}>
            <Amount value={sums.income} kind="in" compact variant="title3" />
            <Amount value={sums.spending} kind="out" compact variant="title3" />
          </View>
        </Card>
      ) : null}

      {isPending ? null : groups.length === 0 ? (
        <EmptyState
          icon={searching || count ? 'search_off' : 'receipt_long'}
          title={searching || count ? 'Nothing matches' : 'No activity yet'}
          body={
            searching || count
              ? 'Try another word, or reset the filters.'
              : 'Transactions you add, paste or import show up here, grouped by day.'
          }
          action={
            searching || count
              ? { label: 'Reset filters', onPress: () => filters.reset() }
              : { label: 'Add a transaction', onPress: () => router.push('/add') }
          }
        />
      ) : (
        groups.map((g) => (
          <View key={g.day} style={{ gap: t.space.s2 }}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 }}
            >
              <Text variant="label" color="ink2" accessibilityRole="header">
                {dayLabel(g.day)}
              </Text>
              {g.net ? (
                <Amount value={Math.abs(g.net)} kind={g.net > 0 ? 'in' : 'out'} arrow={false} variant="sub" />
              ) : null}
            </View>
            <Card variant="flush">
              {g.rows.map((r, i) => (
                <TransactionRow
                  key={r.item.txn.id}
                  item={r.item}
                  divider={i > 0}
                  onPress={() => router.push(`/transactions/${r.item.txn.id}`)}
                />
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}
