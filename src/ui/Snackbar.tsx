import { useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useTheme } from '../theme';
import { Text } from './Text';

interface Snack {
  id: number;
  message: string;
  action?: { label: string; onPress: () => void };
}

const useSnackbar = create<{ current: Snack | null }>()(() => ({ current: null }));
let nextId = 1;

/** Shows a short message at the bottom of the screen. A new one replaces the one showing. */
export function showSnackbar(snack: Omit<Snack, 'id'>) {
  useSnackbar.setState({ current: { ...snack, id: nextId++ } });
}

const hide = (id: number) => {
  if (useSnackbar.getState().current?.id === id) useSnackbar.setState({ current: null });
};

const SHOW_MS = 6_000;
const SCREEN_READER_MS = 10_000;
/** Native tab bar height, without the bottom inset. */
const TAB_BAR = Platform.OS === 'ios' ? 49 : 80;

/** Mounted once at the root; shows whatever `showSnackbar` sent. */
export function SnackbarHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const inTabs = (useSegments() as string[]).includes('(tabs)');
  const snack = useSnackbar((s) => s.current);
  const [shown, setShown] = useState<Snack | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  // Keep the last snack on screen while it animates out.
  if (snack && snack !== shown) setShown(snack);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!snack) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setShown(null));
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Android reads the live region by itself.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(snack.message);

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (!cancelled) timer = setTimeout(() => hide(snack.id), on ? SCREEN_READER_MS : SHOW_MS);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [snack, anim]);

  if (!shown) return null;
  const actionColor = t.scheme === 'dark' ? 'brandStrong' : 'onNavy';
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: t.space.s4,
        right: t.space.s4,
        bottom: insets.bottom + (inTabs ? TAB_BAR : 0) + t.space.s3,
        opacity: anim,
        transform: reduceMotion ? [] : [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.s2,
          minHeight: 48,
          paddingLeft: t.space.s4,
          paddingRight: shown.action ? t.space.s1 : t.space.s4,
          borderRadius: t.radius.md,
          backgroundColor: t.colors.navy,
          boxShadow: t.shadowFloat,
        }}
      >
        <Text variant="row" color="onNavy" style={{ flex: 1, paddingVertical: t.space.s3 }}>
          {shown.message}
        </Text>
        {shown.action ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              hide(shown.id);
              shown.action!.onPress();
            }}
            style={({ pressed }) => ({
              minWidth: 44,
              minHeight: 44,
              paddingHorizontal: t.space.s3,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: t.radius.sm,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text variant="title3" color={actionColor}>
              {shown.action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
