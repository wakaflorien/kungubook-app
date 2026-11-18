import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable } from 'react-native';
import { useTheme } from '../theme';

export interface SwitchProps {
  value: boolean;
  /** Takes effect immediately. Consent-type options start off. */
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

/** 51 × 31 switch from the design system (a 44px+ touch area via hitSlop). */
export function Switch({ value, onValueChange, accessibilityLabel, disabled }: SwitchProps) {
  const t = useTheme();
  const [x] = useState(() => new Animated.Value(value ? 1 : 0));

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) x.setValue(value ? 1 : 0);
      else Animated.timing(x, { toValue: value ? 1 : 0, duration: 160, useNativeDriver: true }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [value, x]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={{
        width: 51,
        height: 31,
        borderRadius: t.radius.full,
        borderWidth: 1,
        borderColor: value ? t.colors.brand : t.colors.lineStrong,
        backgroundColor: value ? t.colors.brand : t.colors.surface2,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: 25,
          height: 25,
          borderRadius: 13,
          backgroundColor: value ? t.colors.onBrand : t.colors.surface,
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, 20] }) }],
        }}
      />
    </Pressable>
  );
}
