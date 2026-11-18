import { Host, Toggle } from '@expo/ui/swift-ui';
import { disabled as disabledModifier, labelsHidden, tint } from '@expo/ui/swift-ui/modifiers';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme';
import type { SwitchProps } from './Switch';

/** iOS: a real SwiftUI toggle, tinted with the brand colour. */
export function Switch({ value, onValueChange, accessibilityLabel, disabled }: SwitchProps) {
  const t = useTheme();
  return (
    <Host matchContents>
      <Toggle
        isOn={value}
        label={accessibilityLabel}
        onIsOnChange={(next) => {
          void Haptics.selectionAsync();
          onValueChange(next);
        }}
        modifiers={[labelsHidden(), tint(t.colors.brand), ...(disabled ? [disabledModifier(true)] : [])]}
      />
    </Host>
  );
}
