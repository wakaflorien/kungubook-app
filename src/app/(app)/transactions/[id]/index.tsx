import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionSheetIOS, Alert, Platform, View } from 'react-native';
import { itemAmountKind, itemTile, itemTitle } from '../../../../features/transactions/TransactionRow';
import {
  useConfirmTransaction,
  useRemoveTransaction,
  useTransaction,
} from '../../../../features/transactions/useTransactions';
import type { TransactionItem } from '../../../../db/repositories';
import { formatMoney } from '../../../../lib/money';
import { useTheme } from '../../../../theme';
import {
  Amount,
  Badge,
  Button,
  Card,
  EmptyState,
  HeaderActions,
  ListRow,
  Screen,
  SectionHeader,
  SourceTag,
  Text,
  Tile,
  type SourceKind,
} from '../../../../ui';

function Row({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: t.space.s3,
        minHeight: 48,
        alignItems: 'center',
        paddingHorizontal: t.space.s4,
        paddingVertical: 10,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: t.colors.line,
      }}
    >
      <Text variant="sub" color="ink2">
        {label}
      </Text>
      <Text variant="row" style={{ flexShrink: 1, textAlign: 'right' }} selectable>
        {value}
      </Text>
    </View>
  );
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Kigali',
  });

/** "−RWF 18,500 to Kigali Grocers on 17 Nov will be removed from MTN MoMo and from your reports." (screen 72) */
export function deleteMessage(i: TransactionItem) {
  const t = i.txn;
  const day = new Date(t.occurred_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Kigali',
  });
  if (i.transfer) {
    return `The ${formatMoney(t.amount, t.currency)} transfer from ${i.transfer.from?.name ?? 'one account'} to ${i.transfer.to?.name ?? 'another'} on ${day} will be removed from both accounts. You can't undo this.`;
  }
  const amount = formatMoney(t.amount, t.currency, { sign: t.kind === 'in' ? 'in' : 'out' });
  const who = t.counterparty_text ? ` ${t.kind === 'in' ? 'from' : 'to'} ${t.counterparty_text}` : '';
  return `${amount}${who} on ${day} will be removed from ${i.account?.name ?? 'the account'} and from your reports. You can't undo this.`;
}

/** Screen 03 · Transaction detail, with actions (71) and delete (72). */
export default function TransactionDetail() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: item, isPending } = useTransaction(id);
  const remove = useRemoveTransaction();
  const confirm = useConfirmTransaction();

  if (!item) {
    return (
      <Screen title="Transaction">
        {isPending ? null : (
          <EmptyState
            icon="receipt_long"
            title="This transaction is gone"
            body="It was deleted, maybe on another phone."
          />
        )}
      </Screen>
    );
  }

  const txn = item.txn;
  const editPath = item.transfer
    ? `/transactions/new?edit=${item.transfer.out.id}&kind=transfer`
    : `/transactions/new?edit=${txn.id}&kind=${txn.kind}`;

  const askDelete = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(item.transfer ? 'Delete this transfer?' : 'Delete this transaction?', deleteMessage(item), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: item.transfer ? 'Delete transfer' : 'Delete transaction',
        style: 'destructive',
        onPress: () => {
          void remove.mutateAsync(txn.id).then(() => router.back());
        },
      },
    ]);
  };

  // Screen 71 · Actions. "Move to a project" (v1.1) and "Create a rule" (M3) arrive later.
  const openActions = () => {
    const copy = () =>
      router.push(
        `/transactions/new?copy=${item.transfer ? item.transfer.out.id : txn.id}&kind=${item.transfer ? 'transfer' : txn.kind}`,
      );
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: itemTitle(item),
          options: ['Copy as new transaction', item.transfer ? 'Delete transfer' : 'Delete transaction', 'Cancel'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (i) => {
          if (i === 0) copy();
          if (i === 1) askDelete();
        },
      );
    } else {
      Alert.alert(itemTitle(item), undefined, [
        { text: 'Copy as new', onPress: copy },
        { text: 'Delete', style: 'destructive', onPress: askDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const currency = txn.currency;
  return (
    <Screen title="Transaction">
      <HeaderActions
        right={[
          { sf: 'pencil', icon: 'edit', label: 'Edit', onPress: () => router.push(editPath) },
          { sf: 'ellipsis', icon: 'more_horiz', label: 'More actions', onPress: openActions },
        ]}
      />

      <View style={{ alignItems: 'center', gap: t.space.s2 }}>
        <Tile {...itemTile(item)} size={72} round />
        <Text variant="title3" style={{ textAlign: 'center' }}>
          {itemTitle(item)}
        </Text>
        <Amount value={txn.amount} currency={currency} kind={itemAmountKind(item)} variant="title1" />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {txn.status === 'pending_review' ? <Badge label="Needs review" tone="warn" icon="pending" /> : null}
          {txn.has_parts ? <Badge label="Split" icon="call_split" /> : null}
          <SourceTag source={(txn.source ?? 'manual') as SourceKind} />
        </View>
      </View>

      <Card variant="flush">
        <Row label="Date" value={when(txn.occurred_at)} />
        {item.transfer ? (
          <>
            <Row divider label="From" value={item.transfer.from?.name ?? '—'} />
            <Row divider label="To" value={item.transfer.to?.name ?? '—'} />
            {item.transfer.in.amount !== txn.amount ? (
              <Row divider label="Received" value={formatMoney(item.transfer.in.amount, item.transfer.in.currency)} />
            ) : null}
          </>
        ) : (
          <>
            <Row divider label="Account" value={item.account?.name ?? '—'} />
            <Row divider label="Category" value={txn.has_parts ? 'Split' : (item.category?.name ?? 'None')} />
            {txn.counterparty_text ? (
              <Row divider label={txn.kind === 'in' ? 'Received from' : 'Paid to'} value={txn.counterparty_text} />
            ) : null}
          </>
        )}
        <Row divider label="Fee" value={formatMoney(txn.fee ?? 0, currency)} />
        {typeof txn.balance_after === 'number' ? (
          <Row divider label="Balance after" value={formatMoney(txn.balance_after, currency)} />
        ) : null}
        {txn.reference ? <Row divider label="Reference" value={txn.reference} /> : null}
        {txn.note ? <Row divider label="Why" value={txn.note} /> : null}
      </Card>

      {item.parts.length ? (
        <View style={{ gap: t.space.s3 }}>
          <SectionHeader title="Split into" />
          <Card variant="flush">
            {item.parts.map((p, i) => (
              <ListRow
                key={p.txn.id}
                divider={i > 0}
                title={p.category?.name ?? 'No category'}
                subtitle={p.txn.note}
                tile={{ icon: p.category?.icon ?? 'category' }}
                end={<Amount value={p.txn.amount} currency={currency} arrow={false} />}
              />
            ))}
          </Card>
        </View>
      ) : null}

      <View style={{ gap: t.space.s3 }}>
        {txn.status === 'pending_review' ? (
          <Button
            label="Confirm transaction"
            block
            loading={confirm.isPending}
            onPress={() => void confirm.mutateAsync(txn.id)}
          />
        ) : null}
        {!item.transfer ? (
          <Button
            label={txn.has_parts ? 'Change split' : 'Split'}
            variant="secondary"
            block
            onPress={() => router.push(`/transactions/${txn.id}/split`)}
          />
        ) : null}
        <Button
          label={item.transfer ? 'Delete transfer' : 'Delete transaction'}
          variant="danger"
          block
          onPress={askDelete}
        />
      </View>
    </Screen>
  );
}
