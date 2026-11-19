import { useRouter } from 'expo-router';
import { ActionSheetIOS, Alert, Platform, Pressable, View } from 'react-native';
import { env } from '../../../../config/env';
import { accountSubtitle, accountTile } from '../../../../features/accounts/meta';
import { useAccounts } from '../../../../features/accounts/useAccounts';
import { SyncBanner } from '../../../../features/sync/SyncBanner';
import { TransactionRow } from '../../../../features/transactions/TransactionRow';
import { useTransactions } from '../../../../features/transactions/useTransactions';
import { greetingName, useSession } from '../../../../state/session';
import { useTheme } from '../../../../theme';
import { Amount, Button, Card, EmptyState, Icon, ListRow, Screen, SectionHeader, Text } from '../../../../ui';
import { HeaderActions } from '../../../../ui/nativeHeader';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function longDate(now = new Date()) {
  return now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Account menu (Settings arrives in M6): a native action sheet on iOS, a Material dialog on Android. */
function useAccountMenu() {
  const { profile, signOut } = useSession();
  const message = `${profile?.email ?? 'You'} will need the password to sign in again. Data saved on this phone is removed.`;
  return () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: profile?.name,
          message,
          options: ['Sign out', 'Cancel'],
          destructiveButtonIndex: 0,
          cancelButtonIndex: 1,
        },
        (i) => {
          if (i === 0) void signOut();
        },
      );
    } else {
      Alert.alert('Sign out of KunguBook?', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ]);
    }
  };
}

function HeroCard({ total, count, currency }: { total: number; count: number; currency: string }) {
  const t = useTheme();
  const router = useRouter();
  return (
    <Card
      variant="hero"
      accessibilityLabel={`Total balance, ${count} accounts`}
      onPress={() => router.push('/accounts')}
    >
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

/** Screen 06 · loading: grey blocks shaped like the rows that are coming. */
function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  const t = useTheme();
  return (
    <Card variant="flush" accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space.s3,
            padding: t.space.s4,
            borderTopWidth: i ? 1 : 0,
            borderTopColor: t.colors.line,
          }}
        >
          <View style={{ width: 40, height: 40, borderRadius: t.radius.md, backgroundColor: t.colors.surface2 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ width: '60%', height: 14, borderRadius: t.radius.sm, backgroundColor: t.colors.surface2 }} />
            <View style={{ width: '40%', height: 12, borderRadius: t.radius.sm, backgroundColor: t.colors.surface2 }} />
          </View>
          <View style={{ width: 72, height: 14, borderRadius: t.radius.sm, backgroundColor: t.colors.surface2 }} />
        </View>
      ))}
    </Card>
  );
}

/** Home's "Recent": the latest five, transfers shown once. */
function Recent() {
  const t = useTheme();
  const router = useRouter();
  const { data } = useTransactions({ limit: 5 });
  if (!data?.length) return null;
  return (
    <View style={{ gap: t.space.s3 }}>
      <SectionHeader
        title="Recent"
        action={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/activity')}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text variant="row" color="brand" style={{ fontFamily: t.type.title3.fontFamily }}>
              See all
            </Text>
          </Pressable>
        }
      />
      <Card variant="flush">
        {data.slice(0, 5).map((item, i) => (
          <TransactionRow
            key={item.txn.id}
            item={item}
            divider={i > 0}
            onPress={() => router.push(`/transactions/${item.txn.id}`)}
          />
        ))}
      </Card>
    </View>
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

export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { data, isPending, isError, error, refetch, isRefetching } = useAccounts();

  const profile = useSession((s) => s.profile);
  const name = greetingName(profile);
  const openAccountMenu = useAccountMenu();

  return (
    <Screen title={name ? `Hi, ${name}` : 'Home'} refreshing={isRefetching} onRefresh={() => void refetch()}>
      <HeaderActions
        left={[
          { sf: 'person.crop.circle', icon: 'account_circle', label: 'Account and sign out', onPress: openAccountMenu },
        ]}
        right={[{ sf: 'bell', icon: 'notifications', label: 'Notifications', onPress: () => {} }]}
      />
      <Text variant="sub" color="ink2" style={{ marginBottom: -t.space.s4 }}>
        {greeting()} · {longDate()}
      </Text>
      <SyncBanner />
      {isPending ? (
        <>
          <HeroSkeleton />
          <RowsSkeleton />
        </>
      ) : isError && !data ? (
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
      ) : data ? (
        <>
          <HeroCard total={data.total.amount} currency={data.total.currency} count={data.data.length} />
          <View style={{ gap: t.space.s3 }}>
            <SectionHeader
              title="Accounts"
              action={
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/accounts')}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text variant="row" color="brand" style={{ fontFamily: t.type.title3.fontFamily }}>
                    See all
                  </Text>
                </Pressable>
              }
            />
            {data.data.length ? (
              <Card variant="flush">
                {data.data.map((a, i) => (
                  <ListRow
                    key={a.id}
                    divider={i > 0}
                    title={a.name ?? ''}
                    subtitle={accountSubtitle(a)}
                    tile={accountTile(a)}
                    end={<Amount value={a.balance} currency={a.currency} />}
                    onPress={() => router.push(`/accounts/${a.id}`)}
                  />
                ))}
              </Card>
            ) : (
              <Card>
                <EmptyState
                  icon="account_balance_wallet"
                  title="Add your first account"
                  body="Mobile money, bank, card or cash: add where you keep money to see your total here."
                  action={{ label: 'Add account', onPress: () => router.push('/accounts/new') }}
                />
              </Card>
            )}
          </View>
          <Recent />
        </>
      ) : null}
    </Screen>
  );
}
