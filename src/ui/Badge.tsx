import { View } from 'react-native';
import { useTheme, type ColorName } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'warn' | 'danger' | 'ok' | 'brand';

const TONES: Record<BadgeTone, { bg: ColorName; fg: ColorName }> = {
  neutral: { bg: 'surface2', fg: 'ink2' },
  warn: { bg: 'warnSoft', fg: 'warn' },
  danger: { bg: 'dangerSoft', fg: 'danger' },
  ok: { bg: 'brandSoft', fg: 'brandStrong' },
  brand: { bg: 'brandSoft', fg: 'brandStrong' },
};

/** State badge (Due tomorrow, Overdue). Warn and danger always carry an icon or word, never colour alone. */
export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: BadgeTone; icon?: string }) {
  const t = useTheme();
  const c = TONES[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 22,
        paddingHorizontal: 8,
        borderRadius: t.radius.full,
        backgroundColor: t.colors[c.bg],
        alignSelf: 'flex-start',
      }}
    >
      {icon ? <Icon name={icon} size={14} color={c.fg} /> : null}
      <Text variant="badge" color={c.fg} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export type SourceKind = 'sms' | 'shortcut' | 'import' | 'email' | 'manual' | 'paste' | 'loan' | 'adjustment';

const SOURCE: Record<SourceKind, { label: string; icon: string }> = {
  sms: { label: 'SMS', icon: 'sms' },
  shortcut: { label: 'Shortcut', icon: 'bolt' },
  import: { label: 'Import', icon: 'upload_file' },
  email: { label: 'Email', icon: 'mail' },
  manual: { label: 'Manual', icon: 'edit' },
  paste: { label: 'Paste', icon: 'content_paste' },
  loan: { label: 'Loan', icon: 'handshake' },
  adjustment: { label: 'Adjust', icon: 'tune' },
};

/** Source tag under a row amount. Always neutral. */
export function SourceTag({ source }: { source: SourceKind }) {
  const t = useTheme();
  const s = SOURCE[source];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        height: 20,
        paddingHorizontal: 6,
        borderRadius: t.radius.sm,
        borderWidth: 1,
        borderColor: t.colors.line,
        alignSelf: 'flex-end',
      }}
    >
      <Icon name={s.icon} size={13} color="ink2" />
      <Text variant="badge" color="ink2">
        {s.label}
      </Text>
    </View>
  );
}
