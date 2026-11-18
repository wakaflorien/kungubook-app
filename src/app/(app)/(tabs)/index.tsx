import { Pressable, View } from 'react-native';
import type { Account } from '../../api';
import { env } from '../../config/env';
import { useAccounts } from '../../features/accounts/useAccounts';
import { useTheme } from '../../theme';
import { Amount, Button, Card, Icon, IconButton, ListRow, Screen, SectionHeader, Text } from '../../ui';

const INITIALS: Record<string, string> = { mtn_momo: 'MTN', airtel_money: 'AT', bk: 'BK', equity: 'EQ', im_bank: 'IM' };

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function longDate(now = new Date()) {
  return now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function Header() {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.s3,
        paddingHorizontal: t.space.s4,
        paddingVertical: t.space.s2,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: t.radius.full,
          backgroundColor: t.colors.brandSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="person" color="brandStrong" />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="sub" color="ink2">
          {longDate()}
        </Text>
        <Text variant="title3" accessibilityRole="header" numberOfLines={1}>
          {greeting()}
        </Text>
      </View>
      <IconButton icon="notifications" label="Notifications" />
    </View>
  );
}

function HeroCard({ total, count, currency }: { total: number; count: number; currency: string }) {
  const t = useTheme();
  return (
    <Card variant="hero" accessibilityLabel={`Total balance, ${count} accounts`}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="label" color="onNavy2">
          Total balance
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text variant="sub" color="onNavy2" style={{ fontSize: 15 }}>
            {count} {count === 1 ? 'account' : 'accounts'}
          </Text>
          <Icon name="chevron_right" size={20} color="onNavy2" />
        </View>
      </View>
      <View style={{ marginTop: t.space.s3 }}>
        <Amount value={total} currency={currency} variant="hero" color="onNavy" />
      </View>
    </Card>
  );
}

function HeroSkeleton() {
  const t = useTheme();
  return (
    <Card variant="hero" accessibilityLabel="Loading balance">
      <View style={{ width: 110, height: 14, borderRadius: t.radius.sm, backgroundColor: t.colors.navy2 }} />
      <View
        style={{
          width: 220,
          height: 36,
          borderRadius: t.radius.sm,
          backgroundColor: t.colors.navy2,
          marginTop: t.space.s4,
        }}
      />
    </Card>
  );
}

function AccountRows({ accounts }: { accounts: Account[] }) {
  return (
    <Card variant="flush">
      {accounts.map((a, i) => (
        <ListRow
          key={a.id}
          divider={i > 0}
          title={a.name ?? ''}
          subtitle={a.number_last ? `•••• ${a.number_last}` : a.type === 'cash' ? 'Counted manually' : undefined}
          tile={
            a.provider && INITIALS[a.provider]
              ? { initials: INITIALS[a.provider] ?? '' }
              : { icon: a.type === 'cash' ? 'payments' : 'account_balance' }
          }
          end={<Amount value={a.balance} currency={a.currency} />}
        />
      ))}
    </Card>
  );
}

export default function HomeScreen() {
  const t = useTheme();
  const { data, isPending, isError, error, refetch, isRefetching } = useAccounts();

  return (
    <Screen tabRoot header={<Header />} refreshing={isRefetching} onRefresh={() => void refetch()}>
      {isPending ? (
        <HeroSkeleton />
      ) : isError ? (
        <Card>
          <View style={{ gap: t.space.s3 }}>
            <View style={{ flexDirection: 'row', gap: t.space.s2, alignItems: 'center' }}>
              <Icon name="cloud_off" color="danger" />
              <Text variant="row" style={{ flex: 1 }}>
                Couldn&apos;t load your balances
              </Text>
            </View>
            <Text variant="sub" color="ink2">
              {env.appEnv === 'mock'
                ? `Start the mock server with “pnpm mock”, then try again. (${error.message})`
                : 'Check your connection and try again.'}
            </Text>
            <Button label="Try again" variant="secondary" size="sm" onPress={() => void refetch()} />
          </View>
        </Card>
      ) : (
        <>
          <HeroCard total={data.total.amount} currency={data.total.currency} count={data.data.length} />
          <View style={{ gap: t.space.s3 }}>
            <SectionHeader
              title="Accounts"
              action={
                <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
                  <Text variant="row" color="brand" style={{ fontFamily: t.type.title3.fontFamily }}>
                    See all
                  </Text>
                </Pressable>
              }
            />
            <AccountRows accounts={data.data} />
          </View>
        </>
      )}
    </Screen>
  );
}
