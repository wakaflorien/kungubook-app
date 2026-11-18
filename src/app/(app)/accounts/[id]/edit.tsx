import { useLocalSearchParams, useRouter } from 'expo-router';
import { AccountForm } from '../../../../features/accounts/AccountForm';
import { useAccount } from '../../../../features/accounts/useAccounts';

/** Screen 75 · Edit account. */
export default function EditAccount() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: account } = useAccount(id);
  if (!account) return null;
  return <AccountForm account={account} onDone={() => router.back()} onCancel={() => router.back()} />;
}
