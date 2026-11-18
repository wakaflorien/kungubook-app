import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Text } from './Text';

export interface ScreenProps {
  children: ReactNode;
  /** Title in the native header (large title on tab roots and lists, set by the stack). */
  title?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * Screen scaffold under a native header: bg, 16px side padding, 24px between sections.
 * `contentInsetAdjustmentBehavior="automatic"` lets iOS place content under the glass header and
 * above the tab bar, and makes large titles collapse on scroll.
 */
export function Screen({ children, title, refreshing, onRefresh }: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {title !== undefined ? <Stack.Screen options={{ title }} /> : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: t.space.s4,
          paddingTop: t.space.s2,
          paddingBottom: insets.bottom + t.space.s6,
          gap: t.space.s6,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.colors.brand} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Uppercase section label with an optional text action ("Calendar", "See all"). */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
        marginBottom: -12,
      }}
    >
      <Text variant="label" color="ink2" accessibilityRole="header">
        {title}
      </Text>
      {action ?? null}
    </View>
  );
}
