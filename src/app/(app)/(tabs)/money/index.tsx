import { useRouter } from 'expo-router';
import { useAccounts } from '../../../../features/accounts/useAccounts';
import { Amount, Card, ListRow, Screen, SectionHeader } from '../../../../ui';

/** Screen 30 · Money hub. M1 has Accounts; loans, contacts, calendar and budgets join in M4–M6. */
export default function MoneyScreen() {
  const router = useRouter();
  const { data } = useAccounts();
  const count = data?.data.length ?? 0;
  return (
    <Screen title="Money">
      <Card variant="flush">
        <ListRow
          title="Accounts"
          subtitle={count ? `${count} ${count === 1 ? 'account' : 'accounts'}` : 'Add where you keep money'}
          tile={{ icon: 'account_balance_wallet', tone: 'brand' }}
          end={data ? <Amount value={data.total.amount} currency={data.total.currency} /> : undefined}
          navigates
          onPress={() => router.push('/accounts')}
        />
      </Card>
      <SectionHeader title="Coming next" />
      <Card variant="flush">
        <ListRow title="Loans" subtitle="Money you owe and money owed to you" tile={{ icon: 'handshake' }} />
        <ListRow divider title="Contacts" subtitle="People you lend to and borrow from" tile={{ icon: 'group' }} />
        <ListRow divider title="Due dates" subtitle="Calendar of payments in and out" tile={{ icon: 'event' }} />
        <ListRow divider title="Budgets" subtitle="Monthly limits by category" tile={{ icon: 'donut_large' }} />
      </Card>
    </Screen>
  );
}
