import { Stack } from 'expo-router';
import { useNativeHeaderOptions } from '../../ui/nativeHeader';

export const unstable_settings = { anchor: 'welcome' };

/** Signed out: Welcome (no header) and the sign-in flows under native headers. */
export default function AuthLayout() {
  return (
    <Stack screenOptions={useNativeHeaderOptions()}>
      <Stack.Screen name="welcome" options={{ headerShown: false, title: 'Welcome' }} />
    </Stack>
  );
}
