import { Host, Switch as ComposeSwitch } from '@expo/ui/jetpack-compose';
import { useTheme } from '../theme';
import type { SwitchProps } from './Switch';

/** Android: a Material 3 switch (Jetpack Compose) in brand colours. */
export function Switch({ value, onValueChange, disabled }: SwitchProps) {
  const t = useTheme();
  return (
    <Host matchContents>
      <ComposeSwitch
        value={value}
        onCheckedChange={onValueChange}
        enabled={!disabled}
        colors={{
          checkedTrackColor: t.colors.brand,
          checkedThumbColor: t.colors.onBrand,
          uncheckedTrackColor: t.colors.surface2,
          uncheckedBorderColor: t.colors.lineStrong,
          uncheckedThumbColor: t.colors.lineStrong,
        }}
      />
    </Host>
  );
}
