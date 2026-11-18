import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { ApiError, type Session } from '../../api';
import { auth } from '../../config/api';
import { SocialButtons } from '../../features/auth/SocialButtons';
import { authErrorMessage } from '../../lib/auth/auth-service';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { Banner, Button, FlowScreen, Input, Text } from '../../ui';

/** Screen 21b · Sign in. */
export default function SignIn() {
  const t = useTheme();
  const router = useRouter();
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const signedIn = useSession((s) => s.signedIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = (session: Session) => void signedIn(session);

  const submit = async () => {
    setPasswordError(undefined);
    setFailure(null);
    if (!email.trim() || !password) {
      setPasswordError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      done(await auth.signIn(email, password));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'invalid_credentials') setPasswordError(authErrorMessage(e));
      else setFailure(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlowScreen
      title="Sign in"
      onBack={() => router.back()}
      footer={<Button label="Sign in" block loading={busy} disabled={!email.trim() || !password} onPress={submit} />}
    >
      {notice === 'password-reset' ? <Banner title="Password changed" body="Sign in with your new password." /> : null}
      <SocialButtons onSession={done} onError={setFailure} disabled={busy} />
      {failure ? <Banner tone="danger" title="Couldn't sign you in" body={failure} /> : null}
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="current-password"
        textContentType="password"
        error={passwordError}
        onSubmitEditing={submit}
      />
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
        style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
      >
        <Text variant="row" color="brand" style={{ fontFamily: t.type.title3.fontFamily }}>
          Forgot password?
        </Text>
      </Pressable>
    </FlowScreen>
  );
}
