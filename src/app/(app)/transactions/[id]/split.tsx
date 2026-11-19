import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { itemTitle } from '../../../../features/transactions/TransactionRow';
import { useCategories, useSplit, useTransaction } from '../../../../features/transactions/useTransactions';
import type { Category, TransactionItem } from '../../../../db/repositories';
import { authErrorMessage } from '../../../../lib/auth/auth-service';
import { splitProblem } from '../../../../lib/ledger';
import { formatMoney } from '../../../../lib/money';
import { useTheme } from '../../../../theme';
import {
  Banner,
  Button,
  Card,
  FlowScreen,
  IconButton,
  MoneyInput,
  Select,
  Text,
  amountFromText,
  textFromAmount,
} from '../../../../ui';

interface PartRow {
  key: number;
  categoryId: string;
  amount: string;
}

/** Split a transaction across categories (US-08). Parts must add up to the total; the balance doesn't change. */
export default function SplitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item } = useTransaction(id);
  const categories = useCategories(item?.txn.kind).data;
  if (!item || !categories) return <FlowScreen title="Split">{null}</FlowScreen>;
  return <SplitForm item={item} categories={categories} />;
}

function SplitForm({
  item,
  categories,
}: {
  item: TransactionItem & { parts: TransactionItem[] };
  categories: Category[];
}) {
  const t = useTheme();
  const router = useRouter();
  const split = useSplit();
  const total = item.txn.amount;
  const currency = item.txn.currency;
  const first = item.txn.category_id ?? categories[0]?.id ?? '';
  const [parts, setParts] = useState<PartRow[]>(() =>
    item.parts.length
      ? item.parts.map((p, i) => ({
          key: i,
          categoryId: p.txn.category_id ?? first,
          amount: textFromAmount(p.txn.amount, currency),
        }))
      : // Both parts start empty, so "left to split" shows the whole amount until the parts add up.
        [
          { key: 0, categoryId: first, amount: '' },
          { key: 1, categoryId: categories.find((c) => c.id !== first)?.id ?? first, amount: '' },
        ],
  );
  const [failure, setFailure] = useState<string | null>(null);

  const amounts = parts.map((p) => amountFromText(p.amount, currency) ?? 0);
  const left = total - amounts.reduce((a, b) => a + b, 0);
  const options = categories.map((c) => ({ value: c.id ?? '', label: c.name ?? '' }));
  const update = (key: number, patch: Partial<PartRow>) => {
    setParts((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
    setFailure(null);
  };

  const save = async () => {
    const problem = splitProblem(total, amounts);
    if (problem) {
      setFailure(problem);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      await split.mutateAsync({
        id: item.txn.id,
        parts: parts.map((p, i) => ({ category_id: p.categoryId, amount: amounts[i]! })),
      });
      router.back();
    } catch (e) {
      setFailure(authErrorMessage(e));
    }
  };

  return (
    <FlowScreen
      title="Split"
      onBack={() => router.back()}
      backIcon="close"
      footer={<Button block label="Save split" loading={split.isPending} onPress={() => void save()} />}
    >
      <Card>
        <Text variant="sub" color="ink2">
          {itemTitle(item)}
        </Text>
        <Text variant="title3">{formatMoney(total, currency)}</Text>
        <Text variant="sub" color={left === 0 ? 'ink2' : 'warn'} accessibilityLiveRegion="polite">
          {left === 0
            ? 'Fully split'
            : left > 0
              ? `${formatMoney(left, currency)} left to split`
              : `${formatMoney(-left, currency)} too much`}
        </Text>
      </Card>
      {failure ? <Banner tone="danger" title="Can't save this split" body={failure} /> : null}

      {parts.map((p, i) => (
        <View key={p.key} style={{ gap: t.space.s2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
            <Text variant="label" color="ink2">
              Part {i + 1}
            </Text>
            {parts.length > 2 ? (
              <IconButton
                icon="delete"
                label={`Remove part ${i + 1}`}
                onPress={() => setParts((ps) => ps.filter((x) => x.key !== p.key))}
              />
            ) : null}
          </View>
          <Select
            label="Category"
            value={p.categoryId}
            options={options}
            onChange={(categoryId) => update(p.key, { categoryId })}
          />
          <MoneyInput
            label="Amount"
            currency={currency}
            text={p.amount}
            onChangeText={(amount) => update(p.key, { amount })}
          />
        </View>
      ))}
      <Button
        label="Add a part"
        variant="secondary"
        onPress={() =>
          setParts((ps) => [
            ...ps,
            {
              key: Math.max(...ps.map((x) => x.key)) + 1,
              categoryId: first,
              amount: left > 0 ? textFromAmount(left, currency) : '',
            },
          ])
        }
      />
    </FlowScreen>
  );
}
