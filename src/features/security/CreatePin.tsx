import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { PIN_LENGTH } from '../../lib/security/pin-lock';
import { biometricInfo, type BiometricInfo } from '../../platform/biometrics';
import { useTheme } from '../../theme';
import { Button, FlowScreen, Icon, PinPad, Switch, Text } from '../../ui';
import type { StepperProps } from '../../ui/FlowScreen';

export interface CreatePinProps {
  title: string;
  stepper?: StepperProps;
  onBack?: () => void;
  finishLabel: string;
  onFinish: (pin: string, biometrics: boolean) => Promise<void>;
}

/** Screen 26 · Create a 4-digit PIN, enter it twice, optionally turn on Face ID / fingerprint. */
export function CreatePin({ title, stepper, onBack, finishLabel, onFinish }: CreatePinProps) {
  const t = useTheme();
  const [first, setFirst] = useState<string | null>(null);
  const [entry, setEntry] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const [bio, setBio] = useState<BiometricInfo | null>(null);
  const [useBio, setUseBio] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void biometricInfo()
      .then(setBio)
      .catch(() => setBio(null));
  }, []);

  const confirmed = first !== null && entry === first;

  const change = (value: string) => {
    setMismatch(false);
    setEntry(value);
    if (value.length < PIN_LENGTH) return;
    if (first === null) {
      setFirst(value);
      setEntry('');
    } else if (value !== first) {
      setMismatch(true);
      setFirst(null);
      setEntry('');
    }
  };

  const finish = async () => {
    if (!confirmed) return;
    setBusy(true);
    try {
      await onFinish(first, !!bio?.available && useBio);
    } finally {
      setBusy(false);
    }
  };

  const heading = first === null ? `Create a ${PIN_LENGTH}-digit PIN` : 'Enter it again';
  const message = mismatch
    ? { text: "Those PINs don't match. Start again.", tone: 'danger' as const }
    : confirmed
      ? { text: 'PIN confirmed.', tone: 'ink2' as const }
      : undefined;

  return (
    <FlowScreen
      title={title}
      onBack={onBack}
      stepper={stepper}
      scroll
      footer={<Button label={finishLabel} block disabled={!confirmed} loading={busy} onPress={finish} />}
    >
      <View style={{ alignItems: 'center', gap: t.space.s2 }}>
        <Text variant="title2" accessibilityRole="header" accessibilityLiveRegion="polite">
          {heading}
        </Text>
        <Text variant="sub" color="ink2" style={{ textAlign: 'center' }}>
          You&apos;ll use it to open the app.
          {bio?.available ? ` ${bio.label[0]!.toUpperCase()}${bio.label.slice(1)} can unlock it for you.` : ''}
        </Text>
      </View>
      <PinPad value={entry} onChange={change} message={message} disabled={busy || confirmed} />
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
