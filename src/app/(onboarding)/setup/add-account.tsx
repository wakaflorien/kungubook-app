import { useLocalSearchParams, useRouter } from 'expo-router';
import { AccountForm } from '../../../features/accounts/AccountForm';
import type { AccountType } from '../../../features/accounts/meta';
import { useMe } from '../../../features/me/useMe';

/** Screen 75 from onboarding ("Add another account"). */
export default function SetupAddAccount() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: AccountType }>();
  const currency = useMe().data?.base_currency ?? 'RWF';
  return (
    <AccountForm
      initialType={type ?? 'mobile_money'}
      baseCurrency={currency}
      onDone={() => router.back()}
      onCancel={() => router.back()}
    />
  );
}
