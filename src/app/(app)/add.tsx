import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTheme, type ColorName } from '../theme';
import { Card, Icon, ListRow, Sheet, Text } from '../ui';

const KINDS: { label: string; icon: string; color: ColorName }[] = [
  { label: 'Expense', icon: 'north_east', color: 'ink' },
  { label: 'Income', icon: 'south_west', color: 'ink' },
  { label: 'Transfer', icon: 'swap_horiz', color: 'ink' },
  { label: 'Loan payment', icon: 'handshake', color: 'ink' },
];

/** Screen 10 · the + sheet. The actions open their flows in M2–M4. */
export default function AddSheet() {
  const router = useRouter();
  const t = useTheme();
  const close = () => router.back();

  return (
    <Sheet title="Add" onClose={close}>
      <View style={{ flexDirection: 'row', gap: t.space.s2 }}>
        {KINDS.map((k) => (
          <Pressable
            key={k.label}
            accessibilityRole="button"
            accessibilityLabel={k.label}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 76,
              borderRadius: t.radius.lg,
              borderWidth: 1,
              borderColor: t.colors.line,
              backgroundColor: pressed ? t.colors.surface2 : t.colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: t.space.s3,
              paddingHorizontal: 4,
            })}
          >
            <Icon name={k.icon} color={k.color} />
            <Text variant="sub" style={{ fontSize: 14, fontFamily: t.type.title3.fontFamily, textAlign: 'center' }}>
              {k.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ gap: t.space.s3, marginTop: t.space.s2 }}>
        <Text variant="label" color="ink2">
          Capture from
        </Text>
        <Card variant="flush">
          <ListRow
            title="Paste a message"
            subtitle="MoMo, Airtel or bank SMS"
            tile={{ icon: 'content_paste' }}
            navigates
            onPress={() => {}}
          />
          <ListRow
            title="Import a statement"
            subtitle="CSV, Excel or PDF"
            tile={{ icon: 'upload_file' }}
            navigates
            divider
            onPress={() => {}}
          />
          <ListRow
            title="Scan a receipt"
            subtitle="Reads the total and the shop name"
            tile={{ icon: 'photo_camera' }}
            navigates
            divider
            onPress={() => {}}
          />
        </Card>
      </View>
    </Sheet>
  );
}
