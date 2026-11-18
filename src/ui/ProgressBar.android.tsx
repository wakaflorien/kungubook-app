import { Host, LinearProgressIndicator } from '@expo/ui/jetpack-compose';
import { useTheme } from '../theme';
import type { ProgressBarProps } from './ProgressBar';

/** Android: a Material 3 linear progress indicator. */
export function ProgressBar({ value }: ProgressBarProps) {
  const t = useTheme();
  return (
    <Host matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
      <LinearProgressIndicator progress={value} color={t.colors.brand} trackColor={t.colors.surface2} />
    </Host>
  );
}
