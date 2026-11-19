import '../platform/polyfills';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  MaterialSymbolsRounded_400Regular,
  MaterialSymbolsRounded_500Medium_Filled,
} from '@expo-google-fonts/material-symbols-rounded';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, LogBox, Platform, View } from 'react-native';
import { queryClient } from '../config/api';
import { useSyncLoop } from '../features/sync/useSyncLoop';
import { createAutoLock } from '../lib/security/auto-lock';
import { useSession, type OnboardingStep } from '../state/session';
import { ThemeProvider, useTheme } from '../theme';
import { Button, EmptyState, Icon } from '../ui';

void SplashScreen.preventAutoHideAsync();

// Dev-only React Navigation notice when a protected group mounts (sign-in, unlock). Each group's layout
// routes itself once mounted, so nothing is lost; hiding it keeps the toast off the pinned buttons.
LogBox.ignoreLogs(["The action 'ROUTE_NAMES_CHANGED'"]);

/** Where each status lives. Groups don't change URLs, so onboarding screens sit under /setup. */
const GROUP = { signedOut: '(auth)', onboarding: '(onboarding)', locked: '(locked)', ready: '(app)' } as const;
const target = (status: keyof typeof GROUP, step: OnboardingStep) =>
  ({ signedOut: '/welcome', onboarding: `/setup/${step}`, locked: '/lock', ready: '/' })[status];
// (The onboarding layout re-checks the step once its navigator has mounted.)

/** Sends the user to the right group whenever the session status changes (sign-in, lock, sign-out…). */
function useStatusRoute() {
  const status = useSession((s) => s.status);
  const step = useSession((s) => s.step);
  const segments = useSegments();
  const router = useRouter();
  const ready = !!useRootNavigationState()?.key;
  const routedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || status === 'booting') return;
    // On every status change go to that status's screen (e.g. the saved onboarding step),
    // and also whenever the user ends up outside the allowed group.
    if (routedFor.current !== status || segments[0] !== GROUP[status]) {
      routedFor.current = status;
      router.replace(target(status, step));
    }
    // Only react to status and group changes, not to every step change inside onboarding.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, status, segments[0]]);
}

/** Locks after the idle time in the background, and hides the screen in the app switcher (TRD §8). */
function useAutoLockAndCover() {
  const [covered, setCovered] = useState(false);
  const [autoLock] = useState(createAutoLock);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const { status, lock } = useSession.getState();
      if (state === 'active') {
        setCovered(false);
        if (autoLock.onForeground()) lock();
      } else {
        if (status === 'ready' || status === 'locked') setCovered(true);
        if (state === 'background') autoLock.onBackground();
      }
    });
    return () => sub.remove();
  }, [autoLock]);
  return covered;
}

function PrivacyCover() {
  const t = useTheme();
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.colors.navy,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="menu_book" size={56} color="onNavy" />
    </View>
  );
}

function UpgradeRequired() {
  const t = useTheme();
  const store =
    Platform.OS === 'ios'
      ? 'https://apps.apple.com/app/kungubook'
      : 'https://play.google.com/store/apps/details?id=app.kungubook.mobile';
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.colors.bg,
        justifyContent: 'center',
        padding: t.space.s4,
      }}
    >
      <EmptyState
        icon="system_update"
        title="Update KunguBook"
        body="This version is too old to talk to KunguBook. Update the app to keep your money in sync."
      />
      <Button label="Open the store" block onPress={() => void Linking.openURL(store)} />
    </View>
  );
}

function Navigator() {
  const t = useTheme();
  const status = useSession((s) => s.status);
  const upgradeRequired = useSession((s) => s.upgradeRequired);
  useStatusRoute();
  const covered = useAutoLockAndCover();
  useSyncLoop(status === 'ready' || status === 'onboarding');

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(t.colors.bg);
  }, [t.colors.bg]);

  return (
    <>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.bg } }}>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'onboarding'}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'locked'}>
          <Stack.Screen name="(locked)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={status === 'ready'}>
          <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
        </Stack.Protected>
      </Stack>
      {upgradeRequired ? <UpgradeRequired /> : null}
      {covered ? <PrivacyCover /> : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    MaterialSymbolsRounded_400Regular,
    MaterialSymbolsRounded_500Medium_Filled,
  });
  const status = useSession((s) => s.status);

  useEffect(() => {
    void useSession.getState().boot();
  }, []);

  const ready = (fontsLoaded || !!fontError) && status !== 'booting';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider appearance="system">
        <Navigator />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
