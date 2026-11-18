import { AppBar, EmptyState, Screen } from '../../../ui';

export default function InsightsScreen() {
  return (
    <Screen tabRoot header={<AppBar title="Insights" />}>
      <EmptyState
        icon="monitoring"
        title="Insights come later"
        body="Spending by category, cash flow and budgets will show here once you have some activity."
      />
    </Screen>
  );
}
