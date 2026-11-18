import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { useTheme } from '../../../theme';

/**
 * System tab bar: Liquid Glass on iOS 26+, Material 3 navigation bar on Android.
 * Home · Activity · Money · Insights, plus "Add" as the prominent (separate) tab on iOS 27+.
 * "Add" never becomes the selected tab: tapping it opens the + sheet (screen 10).
 */
export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();

  const openAdd = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add');
  };

  return (
    <NativeTabs
      tintColor={t.colors.brand}
      minimizeBehavior="onScrollDown"
      labelStyle={{ fontFamily: t.type.label.fontFamily }}
      indicatorColor={t.colors.brandSoft}
      backgroundColor={t.colors.surface}
    >
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <NativeTabs.Trigger.Icon sf="list.bullet.rectangle.portrait" md="receipt_long" />
        <NativeTabs.Trigger.Label>Activity</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="money">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'wallet.bifold', selected: 'wallet.bifold.fill' }}
          md="account_balance_wallet"
        />
        <NativeTabs.Trigger.Label>Money</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="insights">
        <NativeTabs.Trigger.Icon sf="chart.bar.xaxis" md="monitoring" />
        <NativeTabs.Trigger.Label>Insights</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="compose" prominent disabled listeners={{ tabPress: openAdd }}>
        <NativeTabs.Trigger.Icon sf="plus" md="add" />
        <NativeTabs.Trigger.Label>Add</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
