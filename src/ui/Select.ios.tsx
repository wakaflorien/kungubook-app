import { Host, Picker, Text as SwiftText } from '@expo/ui/swift-ui';
import { labelsHidden, pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { useTheme } from '../theme';
import type { SelectProps } from './Select';
import { Text } from './Text';

/**
 * iOS: a settings-style row with the label on the left and a native menu picker on the right
 * (tap shows the system menu with a checkmark on the current value).
 */
export function Select<T extends string>({ label, value, options, onChange, help }: SelectProps<T>) {
  const t = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View
        style={{
          minHeight: 52,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.s3,
          paddingLeft: t.space.s4,
          paddingRight: t.space.s2,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor: t.colors.lineStrong,
          backgroundColor: t.colors.surface,
        }}
      >
        <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
        <Host matchContents>
          <Picker
            label={label}
            selection={value}
            onSelectionChange={(v) => onChange(v as T)}
            modifiers={[pickerStyle('menu'), labelsHidden(), tint(t.colors.brand)]}
          >
            {options.map((o) => (
              <SwiftText key={o.value} modifiers={[tag(o.value)]}>
                {o.label}
              </SwiftText>
            ))}
          </Picker>
        </Host>
      </View>
      {help ? (
        <Text variant="sub" color="ink2">
          {help}
        </Text>
      ) : null}
    </View>
  );
}
