import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

/** Bottom-sheet heights (fraction of the screen): opens tall, can be dragged down to the smaller one. */
const SHEET_DETENTS = [0.6, 0.94];

/** The signed-in, unlocked app: tabs, sheets and sub-pages. */
export default function AppLayout() {
  const t = useTheme();
  return (
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
      <Stack.Screen name="accounts/new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="accounts/[id]/edit" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
