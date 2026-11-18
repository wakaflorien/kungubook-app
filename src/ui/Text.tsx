import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme, type ColorName, type TypeStyle } from '../theme';

export interface TextProps extends RNTextProps {
  /** Type scale from tokens: hero, title1, title2, title3, body, row, sub, label, badge. */
  variant?: TypeStyle;
  color?: ColorName;
  /** Tabular figures, for amounts and dates in columns. */
  tabular?: boolean;
}

export function Text({ variant = 'body', color = 'ink', tabular, style, ...rest }: TextProps) {
  const t = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={variant === 'hero' ? 1.6 : 2.4}
      {...rest}
      style={[t.type[variant], { color: t.colors[color] }, tabular && { fontVariant: ['tabular-nums'] }, style]}
    />
  );
}
