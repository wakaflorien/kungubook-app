import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** The one primary button, at the end. */
  footer?: ReactNode;
}

/**
 * Bottom sheet: scrim, grabber, title, 44px close, content, one primary button at the end.
 * Render it from a route presented as `transparentModal` (see src/app/add.tsx).
 */
export function Sheet({ title, onClose, children, footer }: SheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: t.colors.scrim }}
      />
      <View
        accessibilityViewIsModal
        style={{
          backgroundColor: t.colors.surface,
          borderTopLeftRadius: t.radius.xl,
          borderTopRightRadius: t.radius.xl,
          paddingTop: t.space.s2,
          paddingHorizontal: t.space.s4,
          paddingBottom: Math.max(insets.bottom, t.space.s4) + t.space.s2,
          gap: t.space.s4,
          boxShadow: t.shadowFloat,
        }}
      >
        <View
          style={{
            width: 36,
            height: 5,
            borderRadius: t.radius.full,
            backgroundColor: t.colors.lineStrong,
            alignSelf: 'center',
          }}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="title2" accessibilityRole="header">
            {title}
          </Text>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        {children}
        {footer ?? null}
      </View>
    </View>
  );
}
