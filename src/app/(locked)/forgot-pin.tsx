import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { auth, pinLock } from '../../config/api';
import { authErrorMessage } from '../../lib/auth/auth-service';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { Banner, Button, FlowScreen, Input, Text } from '../../ui';

/** Screen 74 · Forgot PIN: confirm the account password, then choose a new PIN (US-02). */
export default function ForgotPin() {
  const t = useTheme();
  const router = useRouter();
  const { profile, signOut } = useSession();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [tooManyTries, setTooManyTries] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pinLock.passwordRequired().then(setTooManyTries);
  }, []);

  const next = async () => {
    setError(undefined);
    setFailure(null);
    if (!password) {
      setError('Enter your account password.');
      return;
    }
    setBusy(true);
    try {
      if (await auth.verifyPassword(password)) router.replace('/new-pin');
      else setError("That password doesn't match. Try again or reset it.");
    } catch (e) {
      setFailure(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const forgotPasswordToo = () =>
    Alert.alert(
      'Reset your password',
      'To reset your password, sign out first. Your data is safe on KunguBook and comes back when you sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );

  return (
    <FlowScreen
      title="Forgot PIN"
      onBack={tooManyTries ? undefined : () => router.back()}
      footer={<Button label="Continue" block loading={busy} onPress={next} />}
    >
      {tooManyTries ? (
        <Banner tone="warn" title="Too many wrong PINs" body="Confirm your password to choose a new PIN." />
      ) : null}
      <Text variant="body" color="ink2">
        To set a new PIN, confirm it&apos;s you with your account password. Your data stays on this phone.
      </Text>
      {failure ? <Banner tone="danger" title="Couldn't check your password" body={failure} /> : null}
      <Input label="Account email" value={profile?.email ?? ''} editable={false} />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="current-password"
        textContentType="password"
        error={error}
        onSubmitEditing={next}
      />
      <Pressable
        accessibilityRole="button"
        onPress={forgotPasswordToo}
        style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
      >
        <Text variant="row" color="brand" style={{ fontFamily: t.type.title3.fontFamily }}>
          Forgot your password too?
        </Text>
      </Pressable>
    </FlowScreen>
  );
}
