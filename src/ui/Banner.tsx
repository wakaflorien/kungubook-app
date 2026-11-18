import { View } from 'react-native';
import { useTheme, type ColorName } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface BannerProps {
  /** One bold line. */
  title: string;
  /** One plain line. */
  body?: string;
  tone?: 'info' | 'warn' | 'danger';
}

const TONE: Record<NonNullable<BannerProps['tone']>, { bg: ColorName; fg: ColorName; icon: string }> = {
  info: { bg: 'brandSoft', fg: 'brandStrong', icon: 'info' },
  warn: { bg: 'warnSoft', fg: 'warn', icon: 'warning' },
  danger: { bg: 'dangerSoft', fg: 'danger', icon: 'error' },
};

/** Design System §4 Banner: one bold line and one plain line; brand-soft, warn or danger. */
export function Banner({ title, body, tone = 'info' }: BannerProps) {
  const t = useTheme();
  const c = TONE[tone];
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        gap: t.space.s3,
        padding: t.space.s3,
        borderRadius: t.radius.md,
        backgroundColor: t.colors[c.bg],
      }}
    >
      <Icon name={c.icon} color={c.fg} size={22} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="row" style={{ fontFamily: t.type.title3.fontFamily }}>
          {title}
        </Text>
        {body ? (
          <Text variant="sub" color="ink2">
            {body}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
