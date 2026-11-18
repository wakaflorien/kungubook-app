import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { colors, radius, shadowFloat, space, type, type ColorScheme, type Colors } from './tokens';

/** The Appearance setting (screen 87): follow the phone, or force light or dark. */
export type Appearance = 'system' | ColorScheme;

export interface Theme {
  scheme: ColorScheme;
  colors: Colors;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  shadowFloat: string;
}

export function buildTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: colors[scheme], space, radius, type, shadowFloat: shadowFloat[scheme] };
}

const ThemeContext = createContext<Appearance>('system');

export function ThemeProvider({ appearance = 'system', children }: { appearance?: Appearance; children: ReactNode }) {
  return <ThemeContext.Provider value={appearance}>{children}</ThemeContext.Provider>;
}

/** Components read colours, spacing, radius and type only from here. */
export function useTheme(): Theme {
  const appearance = useContext(ThemeContext);
  const system = useColorScheme();
  const scheme: ColorScheme = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;
  return useMemo(() => buildTheme(scheme), [scheme]);
}
