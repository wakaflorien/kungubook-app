import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

export interface CardProps {
  children: ReactNode;
  /** `hero`: the one navy card per screen. `flush`: no padding, for list groups. */
  variant?: 'default' | 'hero' | 'flush';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/** Flat card with a 1px border (cards never get shadows). */
export function Card({ children, variant = 'default', onPress, accessibilityLabel, style }: CardProps) {
  const t = useTheme();
  const base: ViewStyle = {
    backgroundColor: variant === 'hero' ? t.colors.navy : t.colors.surface,
    borderColor: variant === 'hero' ? t.colors.navy : t.colors.line,
    borderWidth: 1,
    borderRadius: t.radius.lg,
    padding: variant === 'flush' ? 0 : variant === 'hero' ? t.space.s5 : t.space.s4,
    overflow: variant === 'flush' ? 'hidden' : 'visible',
  };
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.92 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
