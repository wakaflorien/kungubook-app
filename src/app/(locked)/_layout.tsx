import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export const unstable_settings = { anchor: 'lock' };

export default function GroupLayout() {
  const t = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.bg } }} />;
}
