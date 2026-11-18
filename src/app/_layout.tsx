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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { ApiError } from '../api';
import { ThemeProvider, useTheme } from '../theme';

void SplashScreen.preventAutoHideAsync();

/** Bottom-sheet heights (fraction of the screen): opens tall, can be dragged down to the smaller one. */
const SHEET_DETENTS = [0.6, 0.94];

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry network blips, never auth, validation or upgrade errors.
        retry: (count, err) => count < 2 && (!(err instanceof ApiError) || err.code === 'network' || err.status >= 500),
      },
    },
  });
}

function Navigator() {
  const t = useTheme();
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(t.colors.bg);
  }, [t.colors.bg]);

  return (
    <>
      <StatusBar style={t.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add"
          options={{
            // Native bottom sheet: slides in and out, drag between heights, swipe down to close.
            presentation: 'formSheet',
            sheetAllowedDetents: SHEET_DETENTS,
            sheetInitialDetentIndex: 'last',
            sheetGrabberVisible: true,
            sheetCornerRadius: t.radius.xl,
            contentStyle: { backgroundColor: t.colors.surface },
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(makeQueryClient);
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    MaterialSymbolsRounded_400Regular,
    MaterialSymbolsRounded_500Medium_Filled,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider appearance="system">
        <Navigator />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
