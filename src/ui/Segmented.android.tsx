import { Host, SegmentedButton, SingleChoiceSegmentedButtonRow, Text } from '@expo/ui/jetpack-compose';
import { useTheme } from '../theme';
import type { SegmentedProps } from './Segmented';

/** Android: Material 3 single-choice segmented buttons (Jetpack Compose). */
export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const t = useTheme();
  return (
    <Host matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
      <SingleChoiceSegmentedButtonRow>
        {options.map((o) => (
          <SegmentedButton
            key={o.value}
            selected={o.value === value}
            onClick={() => onChange(o.value)}
            colors={{
              activeContainerColor: t.colors.brandSoft,
              activeContentColor: t.colors.brandStrong,
              activeBorderColor: t.colors.lineStrong,
              inactiveBorderColor: t.colors.lineStrong,
              inactiveContentColor: t.colors.ink,
            }}
          >
            <SegmentedButton.Label>
              <Text>{o.label}</Text>
            </SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
    </Host>
  );
}
