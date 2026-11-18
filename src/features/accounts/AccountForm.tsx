import { useState } from 'react';
import { View } from 'react-native';
import { authErrorMessage } from '../../lib/auth/auth-service';
import { newId } from '../../lib/id';
import { useTheme } from '../../theme';
import {
  Banner,
  Button,
  FlowScreen,
  Input,
  MoneyInput,
  Segmented,
  Select,
  Switch,
  Text,
  amountFromText,
  textFromAmount,
} from '../../ui';
import type { Account } from '../../api';
import { ACCOUNT_TYPES, CURRENCIES, PROVIDERS, providerOptions, type AccountType, type Provider } from './meta';
import { useAccounts, useCreateAccount, useUpdateAccount } from './useAccounts';

export interface AccountFormProps {
  /** Edit an existing account; otherwise create one. */
  account?: Account;
  /** Prefill for a new account (the onboarding quick rows). */
  initialType?: AccountType;
  baseCurrency?: string;
  onDone: (account: Account) => void;
  onCancel: () => void;
}

const defaultProvider = (type: AccountType): Provider =>
  type === 'cash' ? 'cash' : type === 'mobile_money' ? 'mtn_momo' : 'bk';

const defaultName = (type: AccountType, provider: Provider) =>
  type === 'cash' ? 'Cash' : provider === 'other' ? '' : `${PROVIDERS[provider].name}${type === 'card' ? ' card' : ''}`;

/** Screen 75 · Add or edit an account (US-04). */
export function AccountForm({
  account,
  initialType = 'mobile_money',
  baseCurrency = 'RWF',
  onDone,
  onCancel,
}: AccountFormProps) {
  const t = useTheme();
  const editing = !!account;
  const [type, setType] = useState<AccountType>(account?.type ?? initialType);
  const [provider, setProvider] = useState<Provider>(account?.provider ?? defaultProvider(initialType));
  const [name, setName] = useState(account?.name ?? defaultName(initialType, defaultProvider(initialType)));
  const [nameEdited, setNameEdited] = useState(editing);
  const [numberLast, setNumberLast] = useState(account?.number_last ?? '');
  const [currency, setCurrency] = useState(account?.currency ?? baseCurrency);
  const [balance, setBalance] = useState(
    account ? textFromAmount(account.opening_balance ?? 0, account.currency ?? baseCurrency) : '',
  );
  const [linked, setLinked] = useState<string>(
    typeof account?.linked_account_id === 'string' ? account.linked_account_id : '',
  );
  const [includeInTotal, setIncludeInTotal] = useState(account?.include_in_total ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const accounts = useAccounts();
  const banks = (accounts.data?.data ?? []).filter((a) => a.type === 'bank' && a.id !== account?.id);
  const create = useCreateAccount();
  const update = useUpdateAccount(account?.id ?? '');
  const saving = create.isPending || update.isPending;

  const chooseType = (next: AccountType) => {
    setType(next);
    const p = PROVIDERS[provider].types.includes(next) ? provider : defaultProvider(next);
    setProvider(p);
    if (!nameEdited) setName(defaultName(next, p));
  };
  const chooseProvider = (p: Provider) => {
    setProvider(p);
    if (!nameEdited) setName(defaultName(type, p));
  };

  const save = async () => {
    const amount = amountFromText(balance, currency) ?? 0;
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Enter a name, like "MoMo business line".';
    if (numberLast && !/^\d{3,6}$/.test(numberLast)) next.number_last = 'Use the last 3 to 6 digits.';
    if (balance && amountFromText(balance, currency) === null) next.balance = 'Enter the balance as a number.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = {
      type,
      name: name.trim(),
      provider: type === 'cash' ? ('cash' as const) : provider,
      number_last: type === 'cash' ? undefined : numberLast || undefined,
      currency,
      opening_balance: amount,
      include_in_total: includeInTotal,
      linked_account_id: type === 'card' && linked ? linked : null,
    };
    setFailure(null);
    try {
      const saved = account
        ? await update.mutateAsync({ ...body, version: account.version })
        : await create.mutateAsync({ id: newId(), ...body, opening_date: new Date().toISOString().slice(0, 10) });
      onDone(saved);
    } catch (e) {
      setFailure(authErrorMessage(e));
    }
  };

  return (
    <FlowScreen
      title={editing ? 'Edit account' : 'Add account'}
      onBack={onCancel}
      backIcon="close"
      footer={<Button label={editing ? 'Save changes' : 'Save account'} block loading={saving} onPress={save} />}
    >
      {failure ? <Banner tone="danger" title="Couldn't save the account" body={failure} /> : null}

      <View style={{ gap: t.space.s2 }}>
        <Text variant="label" color="ink2">
          Type
        </Text>
        <Segmented
          options={ACCOUNT_TYPES.map((o) => ({ value: o.value, label: o.short }))}
          value={type}
          onChange={chooseType}
        />
      </View>

      {type !== 'cash' ? (
        <Select label="Provider" value={provider} options={providerOptions(type)} onChange={chooseProvider} />
      ) : null}

      <Input
        label="Name"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setNameEdited(true);
        }}
        placeholder="MoMo business line"
        error={errors.name}
        returnKeyType="next"
      />

      {type !== 'cash' ? (
        <Input
          label={`Number (last 3 digits)`}
          value={numberLast}
          onChangeText={(v) => setNumberLast(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="631"
          help="Used to match messages to this account"
          error={errors.number_last}
        />
      ) : null}

      {type === 'card' && banks.length ? (
        <Select
          label="Paid from"
          value={linked}
          options={[
            { value: '', label: 'Not linked' },
            ...banks.map((b) => ({ value: b.id ?? '', label: b.name ?? '' })),
          ]}
          onChange={setLinked}
          help="The bank account this card draws from"
        />
      ) : null}

      <MoneyInput
        label={editing ? 'Opening balance' : 'Balance today'}
        currency={currency}
        text={balance}
        onChangeText={setBalance}
        placeholder="0"
        help={editing ? 'Changing it moves the balance by the same amount.' : undefined}
        error={errors.balance}
      />

      <Select label="Currency" value={currency} options={CURRENCIES} onChange={setCurrency} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.s3,
          padding: t.space.s4,
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: t.colors.line,
          backgroundColor: t.colors.surface,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="row">Include in total balance</Text>
          <Text variant="sub" color="ink2">
            Turn off for accounts you only track
          </Text>
        </View>
        <Switch
          value={includeInTotal}
          onValueChange={setIncludeInTotal}
          accessibilityLabel="Include in total balance"
        />
      </View>
    </FlowScreen>
  );
}
