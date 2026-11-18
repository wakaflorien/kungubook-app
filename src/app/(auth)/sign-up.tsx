import { useRouter } from 'expo-router';
import { useState } from 'react';
import type { Session } from '../../api';
import { ApiError } from '../../api';
import { auth } from '../../config/api';
import { SocialButtons } from '../../features/auth/SocialButtons';
import { authErrorMessage } from '../../lib/auth/auth-service';
import { useSession } from '../../state/session';
import { Banner, Button, FlowScreen, Input, Text } from '../../ui';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Screen 21 · Create account (step 1 of 6). */
export default function SignUp() {
  const router = useRouter();
  const signedIn = useSession((s) => s.signedIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = (session: Session) => void signedIn(session);

  const submit = async () => {
    const next: typeof errors = {};
    if (!EMAIL.test(email.trim())) next.email = 'Enter your email, like you@example.com.';
    if (password.length < 8) next.password = 'Use at least 8 characters.';
    setErrors(next);
    setFailure(null);
    if (next.email || next.password) return;
    setBusy(true);
    try {
      done(await auth.signUp({ email, password }));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'validation_failed' && e.fields) {
        setErrors({ email: e.fields.email, password: e.fields.password });
      } else setFailure(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlowScreen
      title="Create account"
      onBack={() => router.back()}
      stepper={{ step: 1, total: 6, label: 'Account' }}
      footer={<Button label="Continue" block loading={busy} onPress={submit} />}
    >
      <SocialButtons onSession={done} onError={setFailure} disabled={busy} />
      {failure ? <Banner tone="danger" title="Couldn't create your account" body={failure} /> : null}
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        error={errors.email}
      />
      <Input
        label="Password"
        value={password}
        onChangeText={setPassword}
        secure
        autoComplete="new-password"
        textContentType="newPassword"
        help="At least 8 characters"
        error={errors.password}
        onSubmitEditing={submit}
      />
      <Text variant="sub" color="ink2">
        By continuing you agree to the Terms and the Privacy Policy.
      </Text>
    </FlowScreen>
  );
}
