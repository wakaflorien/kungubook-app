import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

export interface SegmentedProps<T extends string> {
  /** 2–4 views of the same thing; put counts in labels ("I owe · 2"). */
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: t.colors.surface2,
        borderRadius: t.radius.md,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: t.space.s2,
              backgroundColor: on ? t.colors.surface : 'transparent',
              boxShadow: on ? '0 1px 2px rgba(14,27,38,0.12)' : undefined,
            }}
          >
            <Text
              variant="sub"
              color={on ? 'ink' : 'ink2'}
              numberOfLines={1}
              style={{ fontSize: 14, fontFamily: t.type.title3.fontFamily }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
