import { DatePicker, Host } from '@expo/ui/swift-ui';
import { labelsHidden, tint } from '@expo/ui/swift-ui/modifiers';
import { View } from 'react-native';
import { useTheme } from '../theme';
import type { DateTimeFieldProps } from './DateTimeField';
import { Text } from './Text';

/** iOS: a settings-style row with the system compact date and time pickers (tap opens the calendar / wheel). */
export function DateTimeField({ label, value, onChange, max }: DateTimeFieldProps) {
  const t = useTheme();
  return (
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
        borderColor: t.colors.line,
        backgroundColor: t.colors.surface,
      }}
    >
      <Text variant="body" style={{ flex: 1 }}>
        {label}
      </Text>
      <Host matchContents>
        <DatePicker
          title={label}
          selection={value}
          range={max ? { end: max } : undefined}
          displayedComponents={['date', 'hourAndMinute']}
          onDateChange={onChange}
          modifiers={[labelsHidden(), tint(t.colors.brand)]}
        />
      </Host>
    </View>
  );
}
