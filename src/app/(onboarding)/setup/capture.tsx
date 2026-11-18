import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { stepNumber, useSession } from '../../../state/session';
import { useTheme } from '../../../theme';
import { Button, Card, FlowScreen, ListRow, Text, Tile } from '../../../ui';

/**
 * Step 5 of 6 · Capture. In v1 this is a tip (App Flow §1); in v1.1 it becomes
 * the iPhone Shortcut (24) or Android SMS (24b) setup.
 */
export default function Capture() {
  const t = useTheme();
  const router = useRouter();
  const goToStep = useSession((s) => s.goToStep);

  const next = async () => {
    await goToStep('pin');
    router.push('/setup/pin');
  };

  return (
    <FlowScreen
      title="Capture"
      onBack={() => router.back()}
      stepper={{ step: stepNumber('capture'), total: 6, label: 'Capture' }}
      footer={<Button label="Continue" block onPress={next} />}
    >
      <View style={{ alignItems: 'center', gap: t.space.s3, paddingTop: t.space.s4 }}>
        <Tile icon="bolt" tone="brand" size={72} round />
        <Text variant="title2" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Let your messages do the typing
        </Text>
        <Text variant="body" color="ink2" style={{ textAlign: 'center' }}>
          Tap + at any time to bring in money you already moved.
        </Text>
      </View>
      <Card variant="flush">
        <ListRow title="Paste a message" subtitle="MoMo, Airtel or bank SMS" tile={{ icon: 'content_paste' }} />
        <ListRow divider title="Import a statement" subtitle="CSV, Excel or PDF" tile={{ icon: 'upload_file' }} />
      </Card>
      <Text variant="sub" color="ink2">
        Message text stays on your phone. Only the amount, date and account are saved.
      </Text>
    </FlowScreen>
  );
}
