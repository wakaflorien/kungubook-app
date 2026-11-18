import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { TAB_BAR_HEIGHT } from './TabBar';
import { Text } from './Text';

export interface ScreenProps {
  children: ReactNode;
  /** Content above the scroll area (an AppBar). */
  header?: ReactNode;
  /** Leave room for the floating tab bar (tab roots only). */
  tabRoot?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Screen scaffold: bg, safe area, 16px side padding, 24px between sections. */
export function Screen({ children, header, tabRoot, refreshing, onRefresh }: ScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      {header}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: t.space.s4,
          paddingBottom: (tabRoot ? TAB_BAR_HEIGHT + insets.bottom : insets.bottom) + t.space.s6,
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
