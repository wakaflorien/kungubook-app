import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme, type ColorName } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type TileTone = 'neutral' | 'brand' | 'in' | 'out' | 'xfer' | 'warn' | 'danger';

const TILE: Record<TileTone, { bg: ColorName; fg: ColorName }> = {
  neutral: { bg: 'surface2', fg: 'ink' },
  brand: { bg: 'brandSoft', fg: 'brandStrong' },
  in: { bg: 'inSoft', fg: 'in' },
  out: { bg: 'outSoft', fg: 'out' },
  xfer: { bg: 'xferSoft', fg: 'xfer' },
  warn: { bg: 'warnSoft', fg: 'warn' },
  danger: { bg: 'dangerSoft', fg: 'danger' },
};

export interface TileProps {
  icon?: string;
  /** Providers appear as text initials on a neutral tile (no logos). */
  initials?: string;
  tone?: TileTone;
  size?: 40 | 48 | 72;
  round?: boolean;
}

export function Tile({ icon, initials, tone = 'neutral', size = 40, round }: TileProps) {
  const t = useTheme();
  const c = TILE[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: round ? t.radius.full : t.radius.md,
        backgroundColor: t.colors[c.bg],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {icon ? (
        <Icon name={icon} size={size >= 72 ? 34 : 22} color={c.fg} />
      ) : (
        <Text variant="sub" color={c.fg} style={{ fontFamily: t.type.label.fontFamily }}>
          {initials}
        </Text>
      )}
    </View>
  );
}

export interface ListRowProps {
  title: string;
  subtitle?: string;
  tile?: TileProps;
  /** Usually an <Amount/> with a SourceTag or Badge under it. */
  end?: ReactNode;
  /** A status badge on its own line under the subtitle. */
  note?: ReactNode;
  /** The whole row is tappable. */
  onPress?: () => void;
  /** Shows a chevron: only when the row navigates. */
  navigates?: boolean;
  /** Draw the divider above (rows after the first inside a card). */
  divider?: boolean;
  compact?: boolean;
}

export function ListRow({ title, subtitle, tile, end, note, onPress, navigates, divider, compact }: ListRowProps) {
  const t = useTheme();
  const content = (
    <>
      {tile ? <Tile {...tile} /> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text variant="row" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="sub" color="ink2" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {note ? <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>{note}</View> : null}
      </View>
      {end ? <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>{end}</View> : null}
      {navigates ? <Icon name="chevron_right" color="ink2" style={{ marginRight: -6 }} /> : null}
    </>
  );

  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.space.s3,
    minHeight: compact ? 52 : 64,
    paddingVertical: 10,
    paddingHorizontal: t.space.s4,
    borderTopWidth: divider ? 1 : 0,
    borderTopColor: t.colors.line,
  };

  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { backgroundColor: t.colors.surface2 }]}
    >
      {content}
    </Pressable>
  );
}
