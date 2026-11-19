import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTheme, type ColorName } from '../../theme';
import { Card, Icon, ListRow, Sheet, Text } from '../../ui';

const KINDS: { label: string; icon: string; color: ColorName; kind?: 'out' | 'in' | 'transfer' }[] = [
  { label: 'Expense', icon: 'north_east', color: 'out', kind: 'out' },
  { label: 'Income', icon: 'south_west', color: 'in', kind: 'in' },
  { label: 'Transfer', icon: 'swap_horiz', color: 'xfer', kind: 'transfer' },
  // Loans arrive in M4.
  { label: 'Loan payment', icon: 'handshake', color: 'ink2' },
];

/** Screen 10 · the + sheet. Expense, income and transfer open Quick add (11); the rest arrive in M3–M4 and v1.1. */
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
            accessibilityLabel={k.kind ? k.label : `${k.label}, coming soon`}
            accessibilityState={{ disabled: !k.kind }}
            disabled={!k.kind}
            onPress={() => {
              if (!k.kind) return;
              // Close the sheet, then open the form, so closing the form goes back to where + was tapped.
              // (A replace from a form sheet to a modal only dismisses the sheet.)
              router.back();
              router.push(`/transactions/new?kind=${k.kind}`);
            }}
            style={({ pressed }) => ({
              opacity: k.kind ? 1 : 0.5,
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
            {k.kind ? null : (
              <Text variant="sub" color="ink2" style={{ fontSize: 12 }}>
                Soon
              </Text>
            )}
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
            subtitle="MoMo, Airtel or bank SMS · coming soon"
            tile={{ icon: 'content_paste' }}
          />
          <ListRow
            title="Import a statement"
            subtitle="CSV, Excel or PDF · coming soon"
            tile={{ icon: 'upload_file' }}
            divider
          />
          <ListRow
            title="Scan a receipt"
            subtitle="Reads the total and the shop name · coming soon"
            tile={{ icon: 'photo_camera' }}
            divider
          />
        </Card>
      </View>
    </Sheet>
  );
}
