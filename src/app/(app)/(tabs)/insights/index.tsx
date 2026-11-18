import { useRouter } from 'expo-router';
import { EmptyState, Screen } from '../../../../ui';

/** Screen 50 · Insights (charts arrive in M6). */
export default function InsightsScreen() {
  const router = useRouter();
  return (
    <Screen title="Insights">
      <EmptyState
        icon="monitoring"
        title="Insights need some activity"
        body="Spending by category, cash flow and budgets appear here once you add transactions."
        action={{ label: 'Add a transaction', onPress: () => router.push('/add') }}
      />
    </Screen>
  );
}
