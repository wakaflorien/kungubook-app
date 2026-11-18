import { Stack } from 'expo-router';
import { useNativeHeaderOptions } from '../../ui/nativeHeader';

export const unstable_settings = { anchor: 'lock' };

/** Locked: the lock screen (no header), Forgot PIN and New PIN under native headers. */
export default function LockedLayout() {
  return (
    <Stack screenOptions={useNativeHeaderOptions()}>
      <Stack.Screen name="lock" options={{ headerShown: false, title: 'Locked' }} />
    </Stack>
  );
}
