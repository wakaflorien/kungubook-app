import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { auth } from '../../config/api';
import { authErrorMessage } from '../../lib/auth/auth-service';
import { useTheme } from '../../theme';
import { Banner, Button, Card, FlowScreen, Input, Text, Tile } from '../../ui';

/** Screen 73 · Reset password: sends a link that works for 1 hour (US-02). */
export default function ForgotPassword() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setError(undefined);
    setFailure(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError('Enter the email you signed up with.');
      return;
    }
    setBusy(true);
    try {
      await auth.forgotPassword(email);
      setSentTo(email.trim());
    } catch (e) {
      setFailure(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FlowScreen
      title="Reset password"
      onBack={() => router.back()}
      footer={
        <>
          <Button label={sentTo ? 'Send again' : 'Send reset link'} block loading={busy} onPress={send} />
          <Button label="Back to sign in" variant="ghost" block onPress={() => router.back()} />
        </>
      }
    >
      <Text variant="body" color="ink2">
        Enter the email you signed up with. We&apos;ll send a link to choose a new password.
      </Text>
      {failure ? <Banner tone="danger" title="Couldn't send the link" body={failure} /> : null}
      <Input
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={error}
        onSubmitEditing={send}
      />
      {sentTo ? (
        <Card>
          <View style={{ flexDirection: 'row', gap: t.space.s3 }}>
            <Tile icon="mark_email_read" tone="brand" />
            <View style={{ flex: 1, gap: 4 }} accessibilityLiveRegion="polite">
              <Text variant="row" style={{ fontFamily: t.type.title3.fontFamily }}>
                Check your email
              </Text>
              <Text variant="sub" color="ink2">
                If an account exists for {sentTo}, the link arrives within a few minutes. It works for 1 hour.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}
    </FlowScreen>
  );
}
