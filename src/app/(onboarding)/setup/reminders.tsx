import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { api, kv } from '../../../config/api';
import { registerDevice, requestNotificationPermission } from '../../../platform/push';
import { stepNumber, useSession } from '../../../state/session';
import { useTheme } from '../../../theme';
import { Button, FlowScreen, Icon, Text, Tile } from '../../../ui';

const REMINDERS = [
  { icon: 'event', title: 'Before a payment is due', body: '7 days, 1 day and on the day' },
  { icon: 'error', title: 'When money is overdue', body: "Both what you owe and what's owed to you" },
  { icon: 'donut_large', title: 'When a budget reaches 80%', body: 'And when it goes over' },
  { icon: 'mail', title: 'Weekly email summary', body: 'Off by default. Turn on in Settings.' },
];

/** Screen 25 · Reminders (step 4 of 6): ask for notification permission, register the device for push. */
export default function Reminders() {
  const t = useTheme();
  const router = useRouter();
  const goToStep = useSession((s) => s.goToStep);
  const [busy, setBusy] = useState(false);

  const next = async () => {
    await goToStep('capture');
    router.push('/setup/capture');
  };

  const turnOn = async () => {
    setBusy(true);
    try {
      await requestNotificationPermission();
      // Registers this phone (POST /me/devices) with its push token when there is one.
      await registerDevice(api, kv).catch(() => undefined);
    } finally {
      setBusy(false);
      await next();
    }
  };

  return (
    <FlowScreen
      title="Reminders"
      onBack={() => router.back()}
      stepper={{ step: stepNumber('reminders'), total: 6, label: 'Reminders' }}
      footer={
        <>
          <Button label="Turn on notifications" block loading={busy} onPress={turnOn} />
          <Button label="Not now" variant="ghost" block onPress={next} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: t.space.s3, paddingTop: t.space.s4 }}>
        <Tile icon="notifications_active" tone="brand" size={72} round />
        <Text variant="title2" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Never miss a due date
        </Text>
        <Text variant="body" color="ink2" style={{ textAlign: 'center' }}>
          We&apos;ll remind you before payments you owe and payments you&apos;re expecting.
        </Text>
      </View>
      <View style={{ gap: t.space.s4 }}>
        {REMINDERS.map((r) => (
          <View key={r.icon} style={{ flexDirection: 'row', gap: t.space.s3, alignItems: 'center' }}>
            <Icon name={r.icon} color="brand" />
            <View style={{ flex: 1 }}>
              <Text variant="row">{r.title}</Text>
              <Text variant="sub" color="ink2">
                {r.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </FlowScreen>
  );
}
