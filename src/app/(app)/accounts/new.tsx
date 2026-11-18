import { useRouter } from 'expo-router';
import { AccountForm } from '../../../features/accounts/AccountForm';
import { useMe } from '../../../features/me/useMe';

/** Screen 75 · Add account. */
export default function NewAccount() {
  const router = useRouter();
  const currency = useMe().data?.base_currency ?? 'RWF';
  return (
    <AccountForm
      baseCurrency={currency}
      onDone={(a) => router.replace(`/accounts/${a.id}`)}
      onCancel={() => router.back()}
    />
  );
}
