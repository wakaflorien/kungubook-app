import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface AppBarProps {
  title: string;
  /**
   * - `root`: tab roots, large left title, no back (one optional action on the right).
   * - `sub`: sub-pages, centred title, 44px back, one action.
   * - `flow`: Close on the left, centred title (the stepper sits below, in the screen).
   */
  variant?: 'root' | 'sub' | 'flow';
  onBack?: () => void;
  /** One action on the right: an IconButton or a text button. */
  action?: ReactNode;
}

export function AppBar({ title, variant = 'root', onBack, action }: AppBarProps) {
  const t = useTheme();

  if (variant === 'root') {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: t.space.s3,
          paddingHorizontal: t.space.s4,
          paddingTop: t.space.s1,
          paddingBottom: t.space.s2,
          minHeight: 52,
        }}
      >
        <Text variant="title1" accessibilityRole="header" numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </Text>
        {action ?? null}
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.space.s2,
        minHeight: 52,
        paddingHorizontal: t.space.s2,
        paddingVertical: 4,
        backgroundColor: t.colors.bg,
      }}
    >
      <View style={{ width: 44, alignItems: 'center' }}>
        <IconButton
          icon={variant === 'flow' ? 'close' : 'arrow_back'}
          label={variant === 'flow' ? 'Close' : 'Back'}
          onPress={onBack}
        />
      </View>
      <Text variant="title3" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </Text>
      <View style={{ minWidth: 44, alignItems: 'center' }}>{action ?? null}</View>
    </View>
  );
}
