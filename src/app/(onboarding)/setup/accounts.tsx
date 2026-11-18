import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import type { Account } from '../../../api';
import { accountSubtitle, accountTile, type AccountType, type Provider } from '../../../features/accounts/meta';
import { useAccounts, useCreateAccount } from '../../../features/accounts/useAccounts';
import { useMe } from '../../../features/me/useMe';
import { authErrorMessage } from '../../../lib/auth/auth-service';
import { newId } from '../../../lib/id';
import { stepNumber, useSession } from '../../../state/session';
import { useTheme } from '../../../theme';
import { Amount, Banner, Button, Card, FlowScreen, ListRow, Text, amountFromText, formatAmountText } from '../../../ui';

interface QuickRow {
  key: string;
  /** Stable client ID, so a retried POST never creates the account twice. */
  id: string;
  type: AccountType;
  provider: Provider;
  name: string;
  initials?: string;
  icon?: string;
}

const QUICK_ROWS: Omit<QuickRow, 'id'>[] = [
  { key: 'momo', type: 'mobile_money', provider: 'mtn_momo', name: 'MTN MoMo', initials: 'MTN' },
  { key: 'airtel', type: 'mobile_money', provider: 'airtel_money', name: 'Airtel Money', initials: 'AT' },
  { key: 'bank', type: 'bank', provider: 'bk', name: 'Bank account', initials: 'BK' },
  { key: 'cash', type: 'cash', provider: 'cash', name: 'Cash', icon: 'payments' },
];

/** Inline balance field for a quick row (right-aligned, 44px). */
function RowAmount({
  value,
  onChange,
  label,
  currency,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  currency: string;
}) {
  const t = useTheme();
  return (
    <TextInput
      accessibilityLabel={`${label} balance today`}
      value={value}
      onChangeText={(v) => onChange(formatAmountText(v, currency))}
      keyboardType="number-pad"
      placeholder="0"
      placeholderTextColor={t.colors.ink2}
      style={{
        width: 128,
        minHeight: 44,
        borderWidth: 1,
        borderColor: t.colors.lineStrong,
        borderRadius: t.radius.md,
        paddingHorizontal: t.space.s3,
        textAlign: 'right',
        color: t.colors.ink,
        fontFamily: t.type.body.fontFamily,
        fontSize: t.type.body.fontSize,
        fontVariant: ['tabular-nums'],
        backgroundColor: t.colors.surface,
      }}
    />
  );
}

/** Screen 23 · Your accounts (step 3 of 6): today's balance for the usual places, or add any account. */
export default function Accounts() {
  const t = useTheme();
  const router = useRouter();
  const goToStep = useSession((s) => s.goToStep);
  const currency = useMe().data?.base_currency ?? 'RWF';
  const existing = useAccounts();
  const create = useCreateAccount();
  const [rows] = useState<QuickRow[]>(() => QUICK_ROWS.map((r) => ({ ...r, id: newId() })));
  const [values, setValues] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const created: Account[] = existing.data?.data ?? [];
  const createdIds = new Set(created.map((a) => a.id));
  const pending = rows.filter((r) => !createdIds.has(r.id));
  const typedTotal = pending.reduce((sum, r) => sum + (amountFromText(values[r.key] ?? '', currency) ?? 0), 0);
  const total = (existing.data?.total.amount ?? 0) + typedTotal;

  const next = async () => {
    setFailure(null);
    setBusy(true);
    try {
      for (const r of pending) {
        const amount = amountFromText(values[r.key] ?? '', currency);
        if (amount === null) continue;
        await create.mutateAsync({
          id: r.id,
          type: r.type,
          provider: r.provider,
          name: r.key === 'bank' ? 'Bank of Kigali' : r.name,
          currency,
          opening_balance: amount,
          opening_date: new Date().toISOString().slice(0, 10),
          include_in_total: true,
        });
      }
      await goToStep('reminders');
      router.push('/setup/reminders');
    } catch (e) {
      setFailure(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const nothingYet = created.length === 0 && typedTotal === 0 && !Object.values(values).some(Boolean);

  return (
    <FlowScreen
      title="Your accounts"
      onBack={() => router.back()}
      stepper={{ step: stepNumber('accounts'), total: 6, label: 'Accounts' }}
      footer={
        <Button
          label={nothingYet ? 'Skip for now' : 'Continue'}
          variant={nothingYet ? 'secondary' : 'primary'}
          block
          loading={busy}
          onPress={next}
        />
      }
    >
      <Text variant="body" color="ink2">
        Add the places where you keep money. Enter today&apos;s balance; KunguBook keeps it up to date.
      </Text>
      {failure ? <Banner tone="danger" title="Couldn't add your accounts" body={failure} /> : null}

      <Card variant="flush">
        {created.map((a, i) => (
          <ListRow
            key={a.id}
            divider={i > 0}
            title={a.name ?? ''}
            subtitle={accountSubtitle(a)}
            tile={accountTile(a)}
            end={<Amount value={a.balance} currency={a.currency} />}
          />
        ))}
        {pending.map((r, i) => (
          <ListRow
            key={r.key}
            divider={created.length + i > 0}
            title={r.name}
            subtitle="Balance today"
            tile={r.initials ? { initials: r.initials } : { icon: r.icon }}
            end={
              <RowAmount
                label={r.name}
                currency={currency}
                value={values[r.key] ?? ''}
                onChange={(v) => setValues((s) => ({ ...s, [r.key]: v }))}
              />
            }
          />
        ))}
        <ListRow
          divider
          title="Card"
          subtitle="Not added"
          tile={{ icon: 'credit_card' }}
          end={
            <Button
              label="Add"
              variant="secondary"
              size="sm"
              onPress={() => router.push({ pathname: '/setup/add-account', params: { type: 'card' } })}
            />
          }
        />
      </Card>

      <Button
        label="Add another account"
        icon="add"
        variant="secondary"
        block
        onPress={() => router.push('/setup/add-account')}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="row" color="ink2">
          Total
        </Text>
        <Amount value={total} currency={currency} />
      </View>
      <Text variant="sub" color="ink2" style={{ marginTop: -t.space.s3 }}>
        Leave a balance empty to skip that account.
      </Text>
    </FlowScreen>
  );
}
