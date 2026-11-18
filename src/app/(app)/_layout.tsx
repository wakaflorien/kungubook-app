import { Stack } from 'expo-router';
import { useTheme } from '../../theme';
import { nativeHeaderOptions } from '../../ui/nativeHeader';

/** Bottom-sheet heights (fraction of the screen): opens tall, can be dragged down to the smaller one. */
const SHEET_DETENTS = [0.6, 0.94];

/** The signed-in, unlocked app: native tabs, sheets and sub-pages with native headers. */
export default function AppLayout() {
  const t = useTheme();
  return (
    <Stack screenOptions={nativeHeaderOptions(t)}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="add"
        options={{
          // Native bottom sheet: slides in and out, drag between heights, swipe down to close.
          headerShown: false,
          presentation: 'formSheet',
          sheetAllowedDetents: SHEET_DETENTS,
          sheetInitialDetentIndex: 'last',
          sheetGrabberVisible: true,
          sheetCornerRadius: t.radius.xl,
          contentStyle: { backgroundColor: t.colors.surface },
        }}
      />
      <Stack.Screen name="accounts/index" options={nativeHeaderOptions(t, { large: true })} />
      <Stack.Screen name="accounts/new" options={{ presentation: 'modal', headerTransparent: false }} />
      <Stack.Screen name="accounts/[id]/edit" options={{ presentation: 'modal', headerTransparent: false }} />
    </Stack>
  );
}
