import { Host, ProgressView } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { useTheme } from '../theme';
import type { ProgressBarProps } from './ProgressBar';

/** iOS: a native linear ProgressView in the brand colour. */
export function ProgressBar({ value, accessibilityLabel }: ProgressBarProps) {
  const t = useTheme();
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}>
      <Host matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
        <ProgressView value={value} modifiers={[tint(t.colors.brand)]} />
      </Host>
    </View>
  );
}
