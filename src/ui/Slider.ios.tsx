import { Host, Slider as SwiftSlider } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import { useTheme } from '../theme';
import type { SliderProps } from './Slider';

/** iOS: a native SwiftUI slider in the brand colour. */
export function Slider({ value, min, max, step, onChange }: SliderProps) {
  const t = useTheme();
  return (
    <Host matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
      <SwiftSlider
        value={value}
        min={min}
        max={max}
        step={step}
        onValueChange={onChange}
        modifiers={[tint(t.colors.brand)]}
      />
    </Host>
  );
}
