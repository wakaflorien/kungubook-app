import { View } from 'react-native';
import { useTheme } from '../theme';
import { dateTimeText } from './dateTimeText';
import { Text } from './Text';

export { dateTimeText };

export interface DateTimeFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  /** Latest allowed moment (money already moved can't be in the future). */
  max?: Date;
}

/** Fallback (web): shows the date only. iOS and Android use the system pickers (DateTimeField.ios/.android). */
export function DateTimeField({ label, value }: DateTimeFieldProps) {
  const t = useTheme();
  return (
    <View
      style={{
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: t.space.s3,
      }}
    >
      <Text variant="body">{label}</Text>
      <Text variant="row">{dateTimeText(value)}</Text>
    </View>
  );
}
