import { Segmented } from './Segmented';

export interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
}

/**
 * Fallback (web): min / middle / max as a segmented choice. iOS and Android use native sliders.
 * Ready for budgets and goals (M6, M8); not used in M1 screens.
 */
export function Slider({ value, min, max, onChange }: SliderProps) {
  const mid = Math.round((min + max) / 2);
  const pick = [min, mid, max].reduce((a, b) => (Math.abs(b - value) < Math.abs(a - value) ? b : a));
  return (
    <Segmented
      options={[min, mid, max].map((v) => ({ value: String(v), label: String(v) }))}
      value={String(pick)}
      onChange={(v) => onChange(Number(v))}
    />
  );
}
