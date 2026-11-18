import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Session } from '../../api';
import { auth } from '../../config/api';
import { authErrorMessage } from '../../lib/auth/auth-service';
import {
  SignInUnavailableError,
  appleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
} from '../../platform/social-sign-in';
import { useTheme } from '../../theme';
import { Button, Text } from '../../ui';

export interface SocialButtonsProps {
  onSession: (session: Session) => void;
  onError: (message: string | null) => void;
  disabled?: boolean;
}

/** "Continue with Apple" (iPhone only) and "Continue with Google", then "or use email". */
export function SocialButtons({ onSession, onError, disabled }: SocialButtonsProps) {
  const t = useTheme();
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  useEffect(() => {
    void appleSignInAvailable().then(setApple);
  }, []);

  const run = async (provider: 'apple' | 'google') => {
    onError(null);
    setBusy(provider);
    try {
      const token = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
      if (!token) return; // cancelled
      onSession(provider === 'apple' ? await auth.signInWithApple(token) : await auth.signInWithGoogle(token));
    } catch (e) {
      onError(e instanceof SignInUnavailableError ? e.message : authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: t.space.s3 }}>
      {apple ? (
        <Button
          label="Continue with Apple"
          icon="phone_iphone"
          variant="secondary"
          block
          loading={busy === 'apple'}
          disabled={disabled || !!busy}
          onPress={() => void run('apple')}
        />
      ) : null}
      <Button
        label="Continue with Google"
        icon="mail"
        variant="secondary"
        block
        loading={busy === 'google'}
        disabled={disabled || !!busy}
        onPress={() => void run('google')}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.s3, marginTop: t.space.s2 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: t.colors.line }} />
        <Text variant="sub" color="ink2">
          or use email
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: t.colors.line }} />
      </View>
    </View>
  );
}
