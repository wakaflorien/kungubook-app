import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  /** Second line in the list. */
  detail?: string;
}

export interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (value: T) => void;
  help?: string;
}

/** A field that opens a bottom list of choices (provider, currency, country…). */
export function Select<T extends string>({ label, value, options, onChange, help }: SelectProps<T>) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <View style={{ gap: 6 }}>
      <Text variant="sub" style={{ fontFamily: t.type.title3.fontFamily, fontSize: 14 }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? 'not set'}`}
        accessibilityHint="Opens the list of choices"
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          minHeight: 48,
          borderWidth: 1,
          borderColor: t.colors.lineStrong,
          borderRadius: t.radius.md,
          backgroundColor: pressed ? t.colors.surface2 : t.colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: t.space.s4,
          paddingRight: t.space.s3,
        })}
      >
        <Text variant="body" style={{ flex: 1 }} numberOfLines={1}>
          {current?.label ?? 'Choose'}
        </Text>
        <Icon name="expand_more" color="ink2" />
      </Pressable>
      {help ? (
        <Text variant="sub" color="ink2">
          {help}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: t.colors.scrim }}
        />
        <View
          style={{
            maxHeight: '70%',
            backgroundColor: t.colors.surface,
            borderTopLeftRadius: t.radius.xl,
            borderTopRightRadius: t.radius.xl,
            paddingBottom: insets.bottom + t.space.s2,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: t.space.s4,
              paddingRight: t.space.s2,
              paddingVertical: t.space.s2,
            }}
          >
            <Text variant="title3" accessibilityRole="header">
              {label}
            </Text>
            <IconButton icon="close" label="Close" onPress={() => setOpen(false)} />
          </View>
          <ScrollView>
            {options.map((o, i) => {
              const selected = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: t.space.s3,
                    paddingHorizontal: t.space.s4,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: t.colors.line,
                    backgroundColor: pressed ? t.colors.surface2 : 'transparent',
                  })}
                >
                  <View style={{ flex: 1, paddingVertical: 10 }}>
                    <Text variant="row">{o.label}</Text>
                    {o.detail ? (
                      <Text variant="sub" color="ink2">
                        {o.detail}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? <Icon name="check" color="brand" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
