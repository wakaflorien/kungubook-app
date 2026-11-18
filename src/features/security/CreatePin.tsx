import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PIN_LENGTH } from '../../lib/security/pin-lock';
import { biometricInfo, type BiometricInfo } from '../../platform/biometrics';
import { useTheme } from '../../theme';
import { FlowScreen, Icon, PinPad, Switch, Text } from '../../ui';
import type { StepperProps } from '../../ui/FlowScreen';

export interface CreatePinProps {
  title: string;
  stepper?: StepperProps;
  /** Shows a ✕ that calls this (e.g. cancel a sign-in). Otherwise the native back button is used. */
  onClose?: () => void;
  onFinish: (pin: string, biometrics: boolean) => Promise<void>;
}

/**
 * Screen 26 · Create a 4-digit PIN. Like the system passcode screens: enter it, enter it again,
 * and it finishes on its own when they match (no confirm button). A mismatch shakes with a haptic.
 */
export function CreatePin({ title, stepper, onClose, onFinish }: CreatePinProps) {
  const t = useTheme();
  const [first, setFirst] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [mismatch, setMismatch] = useState(0);
  const [bio, setBio] = useState<BiometricInfo | null>(null);
  const [useBio, setUseBio] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void biometricInfo()
      .then(setBio)
      .catch(() => setBio(null));
  }, []);

  const change = async (value: string) => {
    setEntry(value);
    if (value.length < PIN_LENGTH) return;
    if (first === null) {
      setFirst(value);
      setEntry('');
      return;
    }
    if (value !== first) {
      setMismatch((n) => n + 1);
      setFirst(null);
      setEntry('');
      return;
    }
    setBusy(true);
    try {
      await onFinish(first, !!bio?.available && useBio);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setBusy(false);
    }
  };

  const heading = first === null ? `Create a ${PIN_LENGTH}-digit PIN` : 'Enter it again';
  const message = busy
    ? { text: 'Saving your PIN…', tone: 'ink2' as const }
    : mismatch && first === null
      ? { text: "Those PINs don't match. Start again.", tone: 'danger' as const }
      : undefined;

  return (
    <FlowScreen title={title} stepper={stepper} onBack={onClose} backIcon={onClose ? 'close' : 'back'}>
      <View style={{ alignItems: 'center', gap: t.space.s2 }}>
        <Text variant="title2" accessibilityRole="header" accessibilityLiveRegion="polite">
          {heading}
        </Text>
        <Text variant="sub" color="ink2" style={{ textAlign: 'center' }}>
          You&apos;ll use it to open the app.
          {bio?.available ? ` ${bio.label[0]!.toUpperCase()}${bio.label.slice(1)} can unlock it for you.` : ''}
        </Text>
      </View>
      <PinPad value={entry} onChange={(v) => void change(v)} message={message} shakeKey={mismatch} disabled={busy} />
      {busy ? <ActivityIndicator color={t.colors.brand} /> : null}
      {bio?.available ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.space.s3,
            padding: t.space.s3,
            borderRadius: t.radius.lg,
            backgroundColor: t.colors.surface,
            borderWidth: 1,
            borderColor: t.colors.line,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: t.radius.md,
              backgroundColor: t.colors.brandSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={bio.icon} color="brandStrong" />
          </View>
          <Text variant="row" style={{ flex: 1 }}>
            Unlock with {bio.label}
          </Text>
          <Switch value={useBio} onValueChange={setUseBio} accessibilityLabel={`Unlock with ${bio.label}`} />
        </View>
      ) : null}
    </FlowScreen>
  );
}
