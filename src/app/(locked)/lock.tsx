import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pinLock } from '../../config/api';
import { PIN_LENGTH } from '../../lib/security/pin-lock';
import { authenticateWithBiometrics, biometricInfo, type BiometricInfo } from '../../platform/biometrics';
import { greetingName, useSession } from '../../state/session';
import { useTheme } from '../../theme';
import { PinPad, Text, Tile } from '../../ui';

type Message = { text: string; tone: 'ink2' | 'danger' } | undefined;

const seconds = (until: number) => Math.max(1, Math.ceil((until - Date.now()) / 1000));

/** Screen 27 · Lock: PIN or biometrics, with waits after repeated wrong PINs (US-03). */
export default function Lock() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, biometricsEnabled, unlock } = useSession();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<Message>();
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [bio, setBio] = useState<BiometricInfo | null>(null);
  const prompted = useRef(false);

  const tryBiometrics = useCallback(async () => {
    if (await authenticateWithBiometrics()) unlock();
  }, [unlock]);

  useEffect(() => {
    void pinLock.lockedUntil().then(setLockedUntil);
    void pinLock.passwordRequired().then((required) => {
      if (required) router.replace('/forgot-pin');
    });
    if (!biometricsEnabled) return;
    void biometricInfo().then((info) => {
      setBio(info);
      if (info.available && !prompted.current) {
        prompted.current = true;
        void tryBiometrics();
      }
    });
  }, [biometricsEnabled, router, tryBiometrics]);

  // Countdown while waiting after too many wrong PINs.
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      if (Date.now() >= lockedUntil) {
        setLockedUntil(null);
        setMessage(undefined);
      } else setMessage({ text: `Too many tries. Try again in ${seconds(lockedUntil)} s.`, tone: 'danger' });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const change = async (value: string) => {
    setPin(value);
    if (value.length < PIN_LENGTH) {
      if (!lockedUntil) setMessage(undefined);
      return;
    }
    setChecking(true);
    const result = await pinLock.verify(value);
    setChecking(false);
    setPin('');
    if (result.ok) return unlock();
    switch (result.reason) {
      case 'wrong':
        if (result.lockedUntil) setLockedUntil(result.lockedUntil);
        else
          setMessage({
            text: `Wrong PIN. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'try' : 'tries'} left before a short wait.`,
            tone: 'danger',
          });
        break;
      case 'locked':
        setLockedUntil(result.lockedUntil);
        break;
      case 'password_required':
      case 'no_pin':
        router.replace('/forgot-pin');
        break;
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.colors.bg,
        paddingTop: insets.top + t.space.s8,
        paddingBottom: Math.max(insets.bottom, t.space.s4),
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ alignItems: 'center', gap: t.space.s3 }}>
        <Tile icon="menu_book" tone="brand" size={48} />
        <Text variant="title2" accessibilityRole="header">
          {profile ? `Welcome back, ${greetingName(profile)}` : 'Welcome back'}
        </Text>
        <Text variant="body" color="ink2">
          Enter your PIN
        </Text>
      </View>
      <PinPad
        value={pin}
        onChange={(v) => void change(v)}
        disabled={checking || !!lockedUntil}
        message={message}
        biometric={
          bio?.available && biometricsEnabled
            ? { icon: bio.icon, label: `Unlock with ${bio.label}`, onPress: () => void tryBiometrics() }
            : undefined
        }
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/forgot-pin')}
        style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: t.space.s4 }}
      >
        <Text variant="row" color="brand" style={{ fontFamily: t.type.title3.fontFamily }}>
          Forgot PIN?
        </Text>
      </Pressable>
    </View>
  );
}
