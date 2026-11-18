import { Tabs, useRouter } from 'expo-router';
import { useTheme } from '../../../theme';
import { TabBar } from '../../../ui';

export default function TabsLayout() {
  const router = useRouter();
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.colors.bg } }}
      tabBar={(props) => <TabBar {...props} onAdd={() => router.push('/add')} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="money" options={{ title: 'Money' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
    </Tabs>
  );
}
