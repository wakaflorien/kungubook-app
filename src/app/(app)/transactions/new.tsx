import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAccounts } from '../../../features/accounts/useAccounts';
import {
  useCategories,
  useCreateTransaction,
  useCreateTransfer,
  useTransaction,
  useUpdateTransaction,
  useUpdateTransfer,
} from '../../../features/transactions/useTransactions';
import type { Acct, Category, TransactionItem } from '../../../db/repositories';
import { authErrorMessage } from '../../../lib/auth/auth-service';
import { useTheme } from '../../../theme';
import {
  Banner,
  Button,
  DateTimeField,
  EmptyState,
  FlowScreen,
  Icon,
  Input,
  MoneyInput,
  Segmented,
  Select,
  Text,
  amountFromText,
  textFromAmount,
} from '../../../ui';

type Kind = 'out' | 'in' | 'transfer';
const KIND_LABEL: Record<Kind, string> = { out: 'Expense', in: 'Income', transfer: 'Transfer' };

/** The form's starting values: empty, or from the transaction being edited or copied. */
interface Initial {
  kind: Kind;
  amount: string;
  fee: string;
  received: string;
  accountId: string;
  toAccountId: string;
  payee: string;
  categoryId: string | null;
  note: string;
  when: Date;
}

function initialFrom(kind: Kind, accounts: Acct[], source: TransactionItem | null, copy: boolean): Initial {
  const first = accounts[0]?.id ?? '';
  if (!source) {
    return {
      kind,
      amount: '',
      fee: '',
      received: '',
      accountId: first,
      toAccountId: accounts.find((a) => a.id !== first)?.id ?? '',
      payee: '',
      categoryId: null,
      note: '',
      when: new Date(),
    };
  }
  const t = source.txn;
  const cur = t.currency;
  return {
    kind: source.transfer ? 'transfer' : t.kind,
    amount: textFromAmount(t.amount, cur),
    fee: t.fee ? textFromAmount(t.fee, cur) : '',
    received: source.transfer ? textFromAmount(source.transfer.in.amount, source.transfer.in.currency) : '',
    accountId: source.transfer ? source.transfer.out.account_id : t.account_id,
    toAccountId: source.transfer ? source.transfer.in.account_id : '',
    payee: source.transfer ? '' : (t.counterparty_text ?? ''),
    categoryId: t.category_id ?? null,
    note: t.note ?? '',
    // "Copy as new transaction": same details, today's date (screen 71).
    when: copy ? new Date() : new Date(t.occurred_at),
  };
}

/** Screen 11 · Quick add: expense, income or transfer. Also edits a transaction or copies one as new. */
export default function QuickAdd() {
  const params = useLocalSearchParams<{ kind?: string; edit?: string; copy?: string }>();
  const sourceId = params.edit ?? params.copy ?? '';
  const source = useTransaction(sourceId);
  const accounts = useAccounts();
  const router = useRouter();

  const list = accounts.data?.data ?? [];
  if (!accounts.data || (sourceId && source.isPending)) return <FlowScreen title="New transaction">{null}</FlowScreen>;
  if (!list.length) {
    return (
      <FlowScreen title="New transaction" onBack={() => router.back()} backIcon="close">
        <EmptyState
          icon="account_balance_wallet"
          title="Add an account first"
          body="Transactions belong to an account, like MoMo, a bank account or cash."
          action={{ label: 'Add account', onPress: () => router.replace('/accounts/new') }}
        />
      </FlowScreen>
    );
  }
  const kind: Kind = params.kind === 'in' || params.kind === 'transfer' ? params.kind : 'out';
  return (
    <QuickAddForm
      initial={initialFrom(kind, list, source.data ?? null, !!params.copy)}
      accounts={list}
      editing={params.edit ? (source.data ?? null) : null}
    />
  );
}

function QuickAddForm({
  initial,
  accounts,
  editing,
}: {
  initial: Initial;
  accounts: Acct[];
  editing: TransactionItem | null;
}) {
  const t = useTheme();
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const set = (patch: Partial<Initial>) => {
    setF((x) => ({ ...x, ...patch }));
    // An edit clears the message about that field.
    setErrors((e) => {
      const keys: Record<string, string> = { amount: 'amount', fee: 'fee', received: 'received', toAccountId: 'to' };
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[keys[k] ?? k];
      return next;
    });
  };

  const categories = useCategories(f.kind === 'in' ? 'in' : 'out').data ?? [];
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const transfer = useCreateTransfer();
  const updateTransfer = useUpdateTransfer();
  const saving = create.isPending || update.isPending || transfer.isPending || updateTransfer.isPending;

  const from = accounts.find((a) => a.id === f.accountId) ?? accounts[0]!;
  const to = accounts.find((a) => a.id === f.toAccountId);
  const currency = from.currency ?? 'RWF';
  const crossCurrency = f.kind === 'transfer' && !!to && to.currency !== from.currency;
  const options = accounts.map((a) => ({ value: a.id, label: a.name ?? 'Account' }));

  const kinds: Kind[] = editing ? (editing.transfer ? ['transfer'] : ['out', 'in']) : ['out', 'in', 'transfer'];

  const save = async () => {
    const amount = amountFromText(f.amount, currency);
    const fee = f.fee ? amountFromText(f.fee, currency) : 0;
    const received = crossCurrency ? amountFromText(f.received, to?.currency ?? currency) : undefined;
    const next: Record<string, string> = {};
    if (!amount || amount < 1) next.amount = 'Enter an amount.';
    if (fee === null) next.fee = 'Enter the fee as a number, or leave it empty.';
    if (f.kind === 'transfer' && (!to || to.id === from.id)) next.to = 'Choose a different account to move money to.';
    if (crossCurrency && !received) next.received = `Enter how much arrived in ${to?.currency}.`;
    setErrors(next);
    if (Object.keys(next).length) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setFailure(null);
    const occurred_at = f.when.toISOString();
    try {
      if (f.kind === 'transfer') {
        const draft = {
          from_account_id: from.id,
          to_account_id: to!.id,
          amount: amount!,
          received_amount: received ?? undefined,
          fee: fee ?? 0,
          occurred_at,
          note: f.note,
        };
        if (editing?.transfer) await updateTransfer.mutateAsync({ group: editing.txn.transfer_group_id!, draft });
        else await transfer.mutateAsync(draft);
      } else {
        const draft = {
          account_id: from.id,
          kind: f.kind,
          amount: amount!,
          fee: f.kind === 'out' ? (fee ?? 0) : 0,
          occurred_at,
          category_id: f.categoryId,
          counterparty_text: f.payee,
          note: f.note,
        };
        if (editing) await update.mutateAsync({ id: editing.txn.id, patch: draft });
        else await create.mutateAsync(draft);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      if (!editing) router.navigate('/activity');
    } catch (e) {
      setFailure(authErrorMessage(e));
    }
  };

  const title = editing ? `Edit ${KIND_LABEL[f.kind].toLowerCase()}` : 'New transaction';
  return (
    <FlowScreen
      title={title}
      onBack={() => router.back()}
      backIcon="close"
      footer={
        <Button
          block
          loading={saving}
          label={editing ? 'Save changes' : `Save ${KIND_LABEL[f.kind].toLowerCase()}`}
          onPress={() => void save()}
        />
      }
    >
      {failure ? <Banner tone="danger" title="Couldn't save" body={failure} /> : null}
      {kinds.length > 1 ? (
        <Segmented
          options={kinds.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
          value={f.kind}
          onChange={(k) => set({ kind: k, categoryId: null })}
        />
      ) : null}

      <MoneyInput
        label={f.kind === 'in' ? 'Money in' : f.kind === 'out' ? 'Money out' : 'Amount to move'}
        currency={currency}
        text={f.amount}
        onChangeText={(amount) => set({ amount })}
        error={errors.amount}
        autoFocus={!editing}
      />

      <Select
        label={f.kind === 'in' ? 'To account' : 'From account'}
        value={from.id}
        options={options}
        onChange={(accountId) => set({ accountId })}
      />
      {f.kind === 'transfer' ? (
        <>
          <Select
            label="To account"
            value={to?.id ?? ''}
            options={options.filter((o) => o.value !== from.id)}
            onChange={(toAccountId) => set({ toAccountId })}
            help={errors.to}
          />
          {crossCurrency ? (
            <MoneyInput
              label="Amount received"
              currency={to!.currency ?? 'RWF'}
              text={f.received}
              onChangeText={(received) => set({ received })}
              error={errors.received}
            />
          ) : null}
        </>
      ) : (
        <Input
          label={f.kind === 'in' ? 'Received from' : 'Paid to'}
          placeholder={f.kind === 'in' ? 'Who paid you' : 'Shop, person or service'}
          value={f.payee}
          onChangeText={(payee) => set({ payee })}
          autoCapitalize="words"
          maxLength={120}
        />
      )}

      <DateTimeField label="Date" value={f.when} max={new Date()} onChange={(when) => set({ when })} />

      {f.kind !== 'transfer' ? (
        <View style={{ gap: t.space.s2 }}>
          <Text variant="label" color="ink2">
            Category
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.space.s2 }}>
            {categories.map((c) => (
              <CategoryTile
                key={c.id}
                category={c}
                selected={f.categoryId === c.id}
                onPress={() => set({ categoryId: f.categoryId === c.id ? null : c.id })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {f.kind !== 'in' ? (
        <MoneyInput
          label="Fee (optional)"
          currency={currency}
          text={f.fee}
          onChangeText={(fee) => set({ fee })}
          error={errors.fee}
          help="Charged by MoMo, Airtel or the bank."
        />
      ) : null}

      <Input
        label="Why? (optional)"
        placeholder="Add a note"
        value={f.note}
        onChangeText={(note) => set({ note })}
        maxLength={500}
        multiline
      />
    </FlowScreen>
  );
}

/** A category choice: icon tile and name, 4 per row. */
function CategoryTile({ category, selected, onPress }: { category: Category; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={category.name ?? 'Category'}
      onPress={onPress}
      style={({ pressed }) => ({
        width: '23%',
        minHeight: 76,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: t.space.s2,
        paddingHorizontal: 2,
        borderRadius: t.radius.lg,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? t.colors.brand : t.colors.line,
        backgroundColor: selected ? t.colors.brandSoft : pressed ? t.colors.surface2 : t.colors.surface,
      })}
    >
      <Icon name={category.icon ?? 'category'} color={selected ? 'brandStrong' : 'ink'} />
      <Text
        variant="sub"
        numberOfLines={2}
        style={{ fontSize: 12, textAlign: 'center' }}
        color={selected ? 'brandStrong' : 'ink'}
      >
        {category.name}
      </Text>
    </Pressable>
  );
}
