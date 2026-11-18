import { useRouter } from 'expo-router';
import { EmptyState, Screen } from '../../../../ui';
import { HeaderActions } from '../../../../ui/nativeHeader';

/** Screen 02 · Activity (transactions arrive in M2). */
export default function ActivityScreen() {
  const router = useRouter();
  return (
    <Screen title="Activity">
      <HeaderActions right={[{ sf: 'magnifyingglass', icon: 'search', label: 'Search', onPress: () => {} }]} />
      <EmptyState
        icon="receipt_long"
        title="No activity yet"
        body="Transactions you add, paste or import show up here, grouped by day."
        action={{ label: 'Add a transaction', onPress: () => router.push('/add') }}
      />
    </Screen>
  );
}
