import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { auth } from '../../config/api';
import { authErrorMessage } from '../../lib/auth/auth-service';
import { Banner, Button, FlowScreen, Input, Text } from '../../ui';

/**
 * Opened from the reset email: kungubook://reset-password?token=…
 * Choose a new password, then sign in with it.
 */
export default function ResetPassword() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(undefined);
    setFailure(null);
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      await auth.resetPassword(token ?? '', password);
      router.replace({ pathname: '/sign-in', params: { notice: 'password-reset' } });
    } catch (e) {
      setFailure(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlowScreen
      title="New password"
      onBack={() => router.replace('/welcome')}
      backIcon="close"
      footer={<Button label="Save password" block loading={busy} onPress={save} />}
    >
      {!token ? (
        <Banner tone="warn" title="Open the link from the email" body="This screen needs the link we emailed you." />
      ) : null}
      {failure ? <Banner tone="danger" title="Couldn't change the password" body={failure} /> : null}
      <Text variant="body" color="ink2">
        Choose a new password for KunguBook. You&apos;ll be signed out on your other phones.
      </Text>
      <Input
        label="New password"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        help="At least 8 characters"
        error={error}
        onSubmitEditing={save}
      />
    </FlowScreen>
  );
}
