import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface PinPadProps {
  value: string;
  length?: number;
  onChange: (value: string) => void;
  /** Biometric key in the bottom-left (Face ID / fingerprint). */
  biometric?: { icon: string; label: string; onPress: () => void };
  disabled?: boolean;
  /** Shown under the dots and announced. */
  message?: { text: string; tone: 'ink2' | 'danger' };
  /** Change this number to shake the dots with an error haptic (wrong or mismatched PIN). */
  shakeKey?: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** PIN dots and a 3×4 keypad with 64px round keys (screens 26, 27). */
export function PinPad({ value, length = 4, onChange, biometric, disabled, message, shakeKey }: PinPadProps) {
  const t = useTheme();
  const [shake] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!shakeKey) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) return;
      shake.setValue(0);
      Animated.sequence(
        [10, -10, 8, -8, 4, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 50, useNativeDriver: true })),
      ).start();
    });
  }, [shakeKey, shake]);

  // Taps can arrive faster than re-renders; build each new value from the latest one, not a stale prop.
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);
  const update = (next: string) => {
    // A full PIN is always consumed by the screen (checked or stored, then cleared), so start the next
    // entry from empty right away instead of waiting for the cleared value to come back as a prop.
    latest.current = next.length >= length ? '' : next;
    onChange(next);
  };
  const press = (digit: string) => {
    if (disabled || latest.current.length >= length) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    update(latest.current + digit);
  };
  const erase = () => {
    if (!latest.current) return;
    void Haptics.selectionAsync();
    update(latest.current.slice(0, -1));
  };

  const key = (label: string) => (
    <Pressable
      key={label}
      accessibilityRole="keyboardkey"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => press(label)}
      style={({ pressed }) => ({
        width: 72,
        height: 72,
        borderRadius: t.radius.full,
        borderWidth: 1,
        borderColor: t.colors.lineStrong,
        backgroundColor: pressed ? t.colors.surface2 : t.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Text variant="title1" style={{ fontFamily: t.type.row.fontFamily }}>
        {label}
      </Text>
    </Pressable>
  );

  const side = (icon: string, label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={28} color="ink" />
    </Pressable>
  );

  return (
    <View style={{ alignItems: 'center', gap: t.space.s6 }}>
      <Animated.View
        accessible
        accessibilityLabel={`${value.length} of ${length} digits entered`}
        style={{
          flexDirection: 'row',
          gap: t.space.s4,
          height: 16,
          alignItems: 'center',
          transform: [{ translateX: shake }],
        }}
      >
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 2,
              borderColor: t.colors.ink,
              backgroundColor: i < value.length ? t.colors.ink : 'transparent',
            }}
          />
        ))}
      </Animated.View>
      <Text
        variant="sub"
        color={message?.tone ?? 'ink2'}
        accessibilityLiveRegion="polite"
        style={{ minHeight: 18, textAlign: 'center' }}
      >
        {message?.text ?? ' '}
      </Text>
      <View style={{ gap: t.space.s4 }}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={{ flexDirection: 'row', gap: t.space.s6 }}>
            {KEYS.slice(row * 3, row * 3 + 3).map(key)}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: t.space.s6 }}>
          {biometric ? side(biometric.icon, biometric.label, biometric.onPress) : <View style={{ width: 72 }} />}
          {key('0')}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete"
            onPress={erase}
            disabled={disabled}
            style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="backspace" size={28} color="ink" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
