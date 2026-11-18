import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useTheme, type ColorName } from '../theme';

/** Font families loaded in src/app/_layout.tsx from @expo-google-fonts/material-symbols-rounded. */
export const ICON_FONT = 'MaterialSymbolsRounded_400Regular';
export const ICON_FONT_FILLED = 'MaterialSymbolsRounded_500Medium_Filled';

export interface IconProps {
  /** Material Symbols ligature name, e.g. `home`, `north_east`, `account_balance_wallet`. */
  name: string;
  size?: number;
  color?: ColorName;
  /** Filled style (active tab, emphasis). */
  filled?: boolean;
  style?: StyleProp<TextStyle>;
}

/** Material Symbols Rounded, rendered through the font's ligatures. Decorative: hidden from screen readers. */
export function Icon({ name, size = 24, color = 'ink', filled, style }: IconProps) {
  const t = useTheme();
  return (
    <Text
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      allowFontScaling={false}
      style={[
        {
          fontFamily: filled ? ICON_FONT_FILLED : ICON_FONT,
          fontSize: size,
          lineHeight: size,
          width: size,
          height: size,
          textAlign: 'center',
          color: t.colors[color],
          includeFontPadding: false,
        },
        style,
      ]}
    >
      {name}
    </Text>
  );
}
