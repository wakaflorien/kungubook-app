import { AppBar, EmptyState, Screen } from '../../ui';

export default function MoneyScreen() {
  return (
    <Screen tabRoot header={<AppBar title="Money" />}>
      <EmptyState
        icon="account_balance_wallet"
        title="Accounts, loans and people"
        body="Your accounts, loans, contacts and calendar will live here."
      />
    </Screen>
  );
}
