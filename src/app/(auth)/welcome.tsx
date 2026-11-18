import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Amount, Button, Card, Icon, Text, Tile } from '../../ui';

const FEATURES = [
  { icon: 'lock', text: 'Private: protected by your PIN and Face ID' },
  { icon: 'bolt', text: 'Captures MoMo, Airtel and bank messages' },
  { icon: 'notifications', text: 'Reminders for payments in and out' },
];

/** Screen 20 · Welcome. */
export default function Welcome() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: t.space.s4, paddingTop: t.space.s8, gap: t.space.s6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.s3 }}>
          <Tile icon="menu_book" tone="brand" />
          <Text variant="title3">KunguBook</Text>
        </View>
        <View style={{ gap: t.space.s3 }}>
          <Text variant="title1" accessibilityRole="header">
            Every franc in one place.
          </Text>
          <Text variant="body" color="ink2">
            Track your accounts, the money you owe and the money owed to you, your projects and your goals. Get reminded
            before anything is due.
          </Text>
        </View>

        {/* An illustration with the sample figures, not real data. */}
        <Card variant="hero" accessibilityLabel="Example: total balance, money you owe and money owed to you">
          <Text variant="label" color="onNavy2">
            Total balance
          </Text>
          <View style={{ marginTop: t.space.s2 }}>
            <Amount value={3_480_000} variant="title1" color="onNavy" />
          </View>
          <View
            style={{
              flexDirection: 'row',
              marginTop: t.space.s4,
              paddingTop: t.space.s3,
              borderTopWidth: 1,
              borderTopColor: t.colors.navy2,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="sub" color="onNavy2">
                You owe
              </Text>
              <Amount value={3_280_800} compact color="onNavy" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="sub" color="onNavy2">
                Owed to you
              </Text>
              <Amount value={110_000} compact color="onNavy" />
            </View>
          </View>
        </Card>

        <View style={{ gap: t.space.s3 }}>
          {FEATURES.map((f) => (
            <View key={f.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.s3 }}>
              <Icon name={f.icon} color="brand" />
              <Text variant="row" style={{ flex: 1 }}>
                {f.text}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
      <View
        style={{
          padding: t.space.s4,
          paddingBottom: Math.max(insets.bottom, t.space.s4),
          gap: t.space.s2,
        }}
      >
        <Button label="Create account" block onPress={() => router.push('/sign-up')} />
        <Button label="I already have an account" variant="ghost" block onPress={() => router.push('/sign-in')} />
      </View>
    </View>
  );
}
