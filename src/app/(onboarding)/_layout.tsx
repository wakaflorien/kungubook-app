import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useSession } from '../../state/session';
import { useTheme } from '../../theme';

export const unstable_settings = { anchor: 'setup/profile' };

/** Onboarding (US-01): steps 2–6 after sign-up, or only the PIN after a sign-in on a new phone. */
export default function OnboardingLayout() {
  const t = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // The group opens on its anchor. Once this navigator exists, jump to the saved step
  // (e.g. straight to the PIN after a sign-in, or back where the user left off).
  useEffect(() => {
    const step = useSession.getState().step;
    if (pathname !== `/setup/${step}`) router.replace(`/setup/${step}`);
    // Only on mount: later steps are pushed by the screens themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.bg } }}>
      <Stack.Screen name="setup/profile" />
      <Stack.Screen name="setup/accounts" />
      <Stack.Screen name="setup/add-account" options={{ presentation: 'modal' }} />
      <Stack.Screen name="setup/reminders" />
      <Stack.Screen name="setup/capture" />
      <Stack.Screen name="setup/pin" />
    </Stack>
  );
}
