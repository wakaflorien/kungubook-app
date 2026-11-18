import { useRouter } from 'expo-router';
import { AppBar, EmptyState, IconButton, Screen } from '../../ui';

export default function ActivityScreen() {
  const router = useRouter();
  return (
    <Screen tabRoot header={<AppBar title="Activity" action={<IconButton icon="search" label="Search" />} />}>
      <EmptyState
        icon="receipt_long"
        title="No activity yet"
        body="Transactions you add, paste or import show up here, grouped by day."
        action={{ label: 'Add a transaction', onPress: () => router.push('/add') }}
      />
    </Screen>
  );
}
