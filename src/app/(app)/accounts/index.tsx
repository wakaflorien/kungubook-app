import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { accountSubtitle, accountTile } from '../../../features/accounts/meta';
import { useAccounts } from '../../../features/accounts/useAccounts';
import { useTheme } from '../../../theme';
import { Amount, AppBar, Badge, Card, EmptyState, IconButton, ListRow, Screen, Text } from '../../../ui';

/** Screen 31 · Accounts (US-04). */
export default function AccountsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { data, refetch, isRefetching } = useAccounts();
  const accounts = data?.data ?? [];

  return (
    <Screen
      header={
        <AppBar
          title="Accounts"
          variant="sub"
          onBack={() => router.back()}
          action={<IconButton icon="add" label="Add account" onPress={() => router.push('/accounts/new')} />}
        />
      }
      refreshing={isRefetching}
      onRefresh={() => void refetch()}
    >
      {data ? (
        <View style={{ gap: t.space.s2, paddingTop: t.space.s2 }}>
          <Text variant="sub" color="ink2">
            Total in {accounts.filter((a) => a.include_in_total).length} accounts
          </Text>
          <Amount value={data.total.amount} currency={data.total.currency} variant="hero" />
        </View>
      ) : null}

      {accounts.length ? (
        <Card variant="flush">
          {accounts.map((a, i) => {
            const mismatch = typeof a.last_reported_balance === 'number' && a.last_reported_balance !== a.balance;
            return (
              <ListRow
                key={a.id}
                divider={i > 0}
                title={a.name ?? ''}
                subtitle={accountSubtitle(a)}
                tile={accountTile(a)}
                end={<Amount value={a.balance} currency={a.currency} />}
                note={
                  mismatch ? (
                    <Badge label="Check balance" tone="warn" icon="error" />
                  ) : !a.include_in_total ? (
                    <Badge label="Not in total" />
                  ) : undefined
                }
                navigates
                onPress={() => router.push(`/accounts/${a.id}`)}
              />
            );
          })}
        </Card>
      ) : data ? (
        <EmptyState
          icon="account_balance_wallet"
          title="No accounts yet"
          body="Add mobile money, bank, card or cash accounts to see your total balance."
          action={{ label: 'Add account', onPress: () => router.push('/accounts/new') }}
        />
      ) : null}
    </Screen>
  );
}
