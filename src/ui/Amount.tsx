import { View } from 'react-native';
import { formatMoney } from '../lib/money';
import { useTheme, type ColorName, type TypeStyle } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type AmountKind = 'in' | 'out' | 'xfer' | 'plain';

export interface AmountProps {
  /** Integer minor units, always positive for in/out/xfer (direction comes from `kind`). */
  value: number;
  currency?: string;
  kind?: AmountKind;
  /** `RWF 1.63M` — only on summary cards. */
  compact?: boolean;
  variant?: TypeStyle;
  /** Show the direction arrow (lists). Direction is never colour alone: sign + arrow + colour. */
  arrow?: boolean;
  /** Override the colour, e.g. `onNavy` on the hero card. */
  color?: ColorName;
}

const ARROW: Record<Exclude<AmountKind, 'plain'>, string> = { in: 'south_west', out: 'north_east', xfer: 'swap_horiz' };

/** The only place amounts are rendered. Formats through `formatMoney()`. */
export function Amount({
  value,
  currency = 'RWF',
  kind = 'plain',
  compact,
  variant = 'row',
  arrow = kind !== 'plain',
  color,
}: AmountProps) {
  const t = useTheme();
  const sign = kind === 'in' ? 'in' : kind === 'out' ? 'out' : 'auto';
  const text = formatMoney(kind === 'plain' ? value : Math.abs(value), currency, { compact, sign });
  const tone: ColorName = color ?? (kind === 'plain' ? 'ink' : kind);
  const label =
    kind === 'in' ? `In ${text}` : kind === 'out' ? `Out ${text}` : kind === 'xfer' ? `Transfer ${text}` : text;

  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {arrow && kind !== 'plain' ? <Icon name={ARROW[kind]} size={16} color={tone} /> : null}
      <Text
        variant={variant}
        color={tone}
        tabular
        numberOfLines={1}
        style={variant === 'row' || variant === 'sub' ? { fontFamily: t.type.title3.fontFamily } : undefined}
      >
        {text}
      </Text>
    </View>
  );
}
