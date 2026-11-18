import { View } from 'react-native';
import { useTheme } from '../theme';

export interface ProgressBarProps {
  /** 0–1. */
  value: number;
  accessibilityLabel: string;
}

/** Fallback (web): a simple brand bar. iOS and Android use native progress views. */
export function ProgressBar({ value, accessibilityLabel }: ProgressBarProps) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      style={{ height: 4, borderRadius: t.radius.full, backgroundColor: t.colors.surface2 }}
    >
      <View
        style={{
          width: `${Math.round(value * 100)}%`,
          height: 4,
          borderRadius: t.radius.full,
          backgroundColor: t.colors.brand,
        }}
      />
    </View>
  );
}
