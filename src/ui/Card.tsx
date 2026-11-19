import type { ReactNode } from 'react';
import { Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
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
        android_ripple={{ color: variant === 'hero' ? t.colors.navy2 : t.colors.surface2, foreground: true }}
        style={({ pressed }) => [
          base,
          // iOS gets a highlight fill; Android shows the ripple above.
          pressed &&
            Platform.OS === 'ios' && { backgroundColor: variant === 'hero' ? t.colors.navy2 : t.colors.surface2 },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
