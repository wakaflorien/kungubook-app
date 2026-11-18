import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { formatMoney } from '../../../../lib/money';
import { PROVIDERS, typeLabel } from '../../../../features/accounts/meta';
import { useAccount, useAccounts } from '../../../../features/accounts/useAccounts';
import { useTheme } from '../../../../theme';
import { Amount, AppBar, Banner, Card, EmptyState, IconButton, Screen, SectionHeader, Text } from '../../../../ui';

function Row({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: t.space.s3,
        minHeight: 52,
        paddingHorizontal: t.space.s4,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: t.colors.line,
      }}
    >
      <Text variant="row" color="ink2">
        {label}
      </Text>
      <Text variant="row" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

/** Screen 32 · Account detail. The balance chart and transactions arrive with M2. */
export default function AccountDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: account, isError } = useAccount(id);
  const linked = useAccounts().data?.data.find((a) => a.id === account?.linked_account_id);

  if (!account) {
    return (
      <Screen header={<AppBar title="Account" variant="sub" onBack={() => router.back()} />}>
        {isError ? <Banner tone="danger" title="Couldn't load this account" body="Pull down to try again." /> : null}
      </Screen>
    );
  }

  const mismatch =
    typeof account.last_reported_balance === 'number' && account.last_reported_balance !== account.balance;

  return (
    <Screen
      header={
        <AppBar
          title={account.name ?? 'Account'}
          variant="sub"
          onBack={() => router.back()}
          action={<IconButton icon="edit" label="Edit account" onPress={() => router.push(`/accounts/${id}/edit`)} />}
        />
      }
    >
      <View style={{ gap: t.space.s2, paddingTop: t.space.s2 }}>
        <Text variant="sub" color="ink2">
          Balance{account.number_last ? ` · •••• ${account.number_last}` : ''}
        </Text>
        <Amount value={account.balance} currency={account.currency} variant="hero" />
        {account.currency !== 'RWF' && account.balance_base !== account.balance ? (
          <Text variant="sub" color="ink2">
            ≈ {formatMoney(account.balance_base, 'RWF')}
          </Text>
        ) : null}
      </View>

      {mismatch ? (
        <Banner
          tone="warn"
          title={`${account.name} is ${formatMoney(Math.abs((account.last_reported_balance as number) - account.balance), account.currency ?? 'RWF')} off`}
          body={`Your last message says ${formatMoney(account.last_reported_balance as number, account.currency ?? 'RWF')}. A transaction may be missing.`}
        />
      ) : null}

      <Card variant="flush">
        <Row label="Type" value={typeLabel(account.type)} />
        {account.provider && account.provider !== 'cash' ? (
          <Row divider label="Provider" value={PROVIDERS[account.provider].name} />
        ) : null}
        <Row divider label="Currency" value={account.currency ?? ''} />
        {linked ? <Row divider label="Paid from" value={linked.name ?? ''} /> : null}
        <Row
          divider
          label="Opening balance"
          value={formatMoney(account.opening_balance ?? 0, account.currency ?? 'RWF')}
        />
        <Row divider label="In total balance" value={account.include_in_total ? 'Yes' : 'No'} />
      </Card>

      <View style={{ gap: t.space.s3 }}>
        <SectionHeader title="Transactions" />
        <Card>
          <EmptyState
            icon="receipt_long"
            title="No transactions yet"
            body="Money you add, paste or import for this account shows up here."
          />
        </Card>
      </View>
    </Screen>
  );
}
