import { useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';
import { env } from '../../../config/env';
import { accountSubtitle, accountTile } from '../../../features/accounts/meta';
import { useAccounts } from '../../../features/accounts/useAccounts';
import { greetingName, useSession } from '../../../state/session';
import { useTheme } from '../../../theme';
import { Amount, Button, Card, EmptyState, Icon, IconButton, ListRow, Screen, SectionHeader, Text } from '../../../ui';

function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function longDate(now = new Date()) {
  return now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase();
}

function Header() {
  const t = useTheme();
  const { profile, signOut } = useSession();
  const name = greetingName(profile);

  // Settings (60) arrives in M6; until then the avatar offers sign-out (93).
  const askSignOut = () =>
    Alert.alert(
      'Sign out of KunguBook?',
      `${profile?.email ?? 'You'} will need the password to sign in again. Data saved on this phone is removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );

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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account and sign out"
        onPress={askSignOut}
        style={{
          width: 44,
          height: 44,
          borderRadius: t.radius.full,
          backgroundColor: t.colors.brandSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {profile ? (
          <Text variant="row" color="brandStrong" style={{ fontFamily: t.type.title3.fontFamily }}>
            {initials(profile.name)}
          </Text>
        ) : (
          <Icon name="person" color="brandStrong" />
        )}
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text variant="sub" color="ink2">
          {longDate()}
        </Text>
        <Text variant="title3" accessibilityRole="header" numberOfLines={1}>
          {name ? `${greeting()}, ${name}` : greeting()}
        </Text>
      </View>
      <IconButton icon="notifications" label="Notifications" />
    </View>
  );
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

  return (
    <Screen tabRoot header={<Header />} refreshing={isRefetching} onRefresh={() => void refetch()}>
      {isPending ? (
        <HeroSkeleton />
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
        </>
      ) : null}
    </Screen>
  );
}
