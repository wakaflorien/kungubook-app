import { DatePickerDialog, Host, TimePickerDialog } from '@expo/ui/jetpack-compose';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import type { DateTimeFieldProps } from './DateTimeField';
import { dateTimeText } from './dateTimeText';
import { Icon } from './Icon';
import { Text } from './Text';

/** Android: an outlined field; tapping it opens the Material 3 date dialog, then the time dialog. */
export function DateTimeField({ label, value, onChange, max }: DateTimeFieldProps) {
  const t = useTheme();
  const [step, setStep] = useState<'closed' | 'date' | 'time'>('closed');
  const [picked, setPicked] = useState(value);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${dateTimeText(value)}`}
        onPress={() => setStep('date')}
        style={{
          minHeight: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.space.s3,
          paddingHorizontal: t.space.s4,
          borderRadius: t.radius.sm,
          borderWidth: 1,
          borderColor: t.colors.lineStrong,
          backgroundColor: t.colors.surface,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="sub" color="ink2" style={{ fontSize: 12 }}>
            {label}
          </Text>
          <Text variant="body">{dateTimeText(value)}</Text>
        </View>
        <Icon name="calendar_today" color="ink2" />
      </Pressable>
      {step !== 'closed' ? (
        <Host matchContents>
          {step === 'date' ? (
            <DatePickerDialog
              initialDate={value.toISOString()}
              color={t.colors.brand}
              selectableDates={max ? { end: max } : undefined}
              onDateSelected={(d) => {
                const next = new Date(value);
                next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                setPicked(next);
                setStep('time');
              }}
              onDismissRequest={() => setStep('closed')}
            />
          ) : (
            <TimePickerDialog
              initialDate={picked.toISOString()}
              is24Hour
              color={t.colors.brand}
              onDateSelected={(d) => {
                const next = new Date(picked);
                next.setHours(d.getHours(), d.getMinutes(), 0, 0);
                onChange(max && next > max ? max : next);
                setStep('closed');
              }}
              onDismissRequest={() => {
                onChange(picked);
                setStep('closed');
              }}
            />
          )}
        </Host>
      ) : null}
    </View>
  );
}
