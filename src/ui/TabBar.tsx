import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export const TAB_ITEMS: Record<string, { label: string; icon: string }> = {
  index: { label: 'Home', icon: 'home' },
  activity: { label: 'Activity', icon: 'receipt_long' },
  money: { label: 'Money', icon: 'account_balance_wallet' },
  insights: { label: 'Insights', icon: 'monitoring' },
};

/** Height of the floating bar plus its outer padding, for content insets. */
export const TAB_BAR_HEIGHT = 64 + 8;

export interface TabBarProps extends BottomTabBarProps {
  onAdd: () => void;
}

/**
 * Floating navy pill: Home · Activity · + · Money · Insights (kit.css `.tabbar`).
 * The bar and its active capsule are fully rounded (r-full). Only on the four tab roots.
 */
export function TabBar({ state, navigateToTab, onAdd }: TabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => r.name in TAB_ITEMS);

  const tab = (routeIndex: number) => {
    const route = routes[routeIndex];
    if (!route) return null;
    const item = TAB_ITEMS[route.name]!;
    const focused = state.routes[state.index]?.key === route.key;
    const onPress = () => {
      if (!focused) navigateToTab(route.key);
    };
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: focused }}
        onPress={onPress}
        style={{
          flex: 1,
          height: 52,
          borderRadius: t.radius.full,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          backgroundColor: focused ? t.colors.navy2 : 'transparent',
        }}
      >
        <Icon name={item.icon} filled={focused} color={focused ? 'onNavy' : 'onNavy2'} />
        <Text
          variant="label"
          color={focused ? 'onNavy' : 'onNavy2'}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          style={{ textTransform: 'none', letterSpacing: 0 }}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 12,
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom - 8, 12),
      }}
    >
      <View
        accessibilityRole="tablist"
        style={{
          height: 64,
          borderRadius: t.radius.full,
          backgroundColor: t.colors.navy,
          paddingHorizontal: 8,
          flexDirection: 'row',
          alignItems: 'center',
          boxShadow: t.shadowFloat,
        }}
      >
        {tab(0)}
        {tab(1)}
        <View style={{ width: 64, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add"
            onPress={onAdd}
            style={({ pressed }) => ({
              width: 56,
              height: 56,
              borderRadius: t.radius.full,
              backgroundColor: pressed ? t.colors.brandStrong : t.colors.brand,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Icon name="add" size={30} color="onBrand" />
          </Pressable>
        </View>
        {tab(2)}
        {tab(3)}
      </View>
    </View>
  );
}
