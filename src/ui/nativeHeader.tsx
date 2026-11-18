import { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, View } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useTheme, type Theme } from '../theme';
import { IconButton } from './IconButton';

/** Object form of a Stack screen's `options`. */
type StackOptions = Exclude<NonNullable<ComponentProps<typeof Stack.Screen>['options']>, (...args: never[]) => unknown>;

/**
 * Native stack header options shared by every stack: system back button and swipe-back,
 * Liquid Glass bar on iOS 26+ (transparent header over scrolling content), Material top bar on Android.
 * `large`: iOS large title that collapses into the bar on scroll (tab roots and list pages).
 */
export function nativeHeaderOptions(t: Theme, { large = false }: { large?: boolean } = {}): StackOptions {
  const ios = Platform.OS === 'ios';
  return {
    headerShown: true,
    headerTransparent: ios,
    headerShadowVisible: false,
    headerLargeTitleEnabled: ios && large,
    headerLargeTitleShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerTintColor: t.colors.brand,
    headerTitleStyle: { fontFamily: t.type.title3.fontFamily, color: t.colors.ink },
    headerLargeTitleStyle: { fontFamily: t.type.title1.fontFamily, color: t.colors.ink },
    headerStyle: ios ? undefined : { backgroundColor: t.colors.bg },
    contentStyle: { backgroundColor: t.colors.bg },
  } as StackOptions;
}

export function useNativeHeaderOptions(opts?: { large?: boolean }) {
  return nativeHeaderOptions(useTheme(), opts);
}

export interface HeaderAction {
  /** SF Symbol for the iOS glass toolbar. */
  sf: SFSymbol;
  /** Material Symbols name for Android. */
  icon: string;
  label: string;
  onPress: () => void;
}

/**
 * Header buttons: Liquid Glass toolbar items on iOS (`Stack.Toolbar`), Material icon buttons on Android.
 * Render it inside the screen component.
 */
export function HeaderActions({ left, right }: { left?: HeaderAction[]; right?: HeaderAction[] }) {
  if (Platform.OS === 'ios') {
    return (
      <>
        {left?.length ? (
          <Stack.Toolbar placement="left">
            {left.map((a) => (
              <Stack.Toolbar.Button key={a.label} icon={a.sf} accessibilityLabel={a.label} onPress={a.onPress} />
            ))}
          </Stack.Toolbar>
        ) : null}
        {right?.length ? (
          <Stack.Toolbar placement="right">
            {right.map((a) => (
              <Stack.Toolbar.Button key={a.label} icon={a.sf} accessibilityLabel={a.label} onPress={a.onPress} />
            ))}
          </Stack.Toolbar>
        ) : null}
      </>
    );
  }
  const row = (actions?: HeaderAction[]) =>
    actions?.length
      ? () => (
          <View style={{ flexDirection: 'row' }}>
            {actions.map((a) => (
              <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} />
            ))}
          </View>
        )
      : undefined;
  return <Stack.Screen options={{ headerLeft: row(left), headerRight: row(right) }} />;
}
