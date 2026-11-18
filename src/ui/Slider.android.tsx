import { Host, Slider as ComposeSlider } from '@expo/ui/jetpack-compose';
import { useTheme } from '../theme';
import type { SliderProps } from './Slider';

/** Android: a Material 3 slider in brand colours. */
export function Slider({ value, min, max, step, onChange }: SliderProps) {
  const t = useTheme();
  const steps = step ? Math.max(0, Math.round((max - min) / step) - 1) : 0;
  return (
    <Host matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
      <ComposeSlider
        value={value}
        min={min}
        max={max}
        steps={steps}
        onValueChange={onChange}
        colors={{ thumbColor: t.colors.brand, activeTrackColor: t.colors.brand, inactiveTrackColor: t.colors.surface2 }}
      />
    </Host>
  );
}
