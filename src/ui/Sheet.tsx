import type { ReactNode } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** The one primary button, pinned at the end. */
  footer?: ReactNode;
}

/**
 * Bottom-sheet content: grabber, title, 44px close, scrolling body, optional pinned footer.
 * Render it from a route presented as a native `formSheet` (see the `add` screen in src/app/_layout.tsx):
 * the platform supplies the slide animation, scrim, drag between heights and swipe to close.
 */
export function Sheet({ title, onClose, children, footer }: SheetProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: t.colors.surface }}>
      {/* iOS draws its own grabber (sheetGrabberVisible); Android's sheet has none. */}
      {Platform.OS === 'android' ? (
        <View
          style={{
            width: 36,
            height: 5,
            borderRadius: t.radius.full,
            backgroundColor: t.colors.lineStrong,
            alignSelf: 'center',
            marginTop: t.space.s2,
          }}
        />
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: t.space.s4,
          paddingRight: t.space.s2,
          paddingTop: Platform.OS === 'ios' ? t.space.s5 : t.space.s3,
          paddingBottom: t.space.s2,
        }}
      >
        <Text variant="title2" accessibilityRole="header">
          {title}
        </Text>
        <IconButton icon="close" label="Close" onPress={onClose} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        contentContainerStyle={{
          paddingHorizontal: t.space.s4,
          paddingTop: t.space.s2,
          paddingBottom: (footer ? t.space.s4 : insets.bottom) + t.space.s6,
          gap: t.space.s4,
        }}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={{
            paddingHorizontal: t.space.s4,
            paddingTop: t.space.s3,
            paddingBottom: Math.max(insets.bottom, t.space.s4),
            borderTopWidth: 1,
            borderTopColor: t.colors.line,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}
