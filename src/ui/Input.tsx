import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  /** Label above the 48px field. */
  label: string;
  /** Help below the field. */
  help?: string;
  /** Says how to fix the problem; replaces the help and turns the border red. */
  error?: string;
  /** Unit at the end of the field ("RWF"). */
  unit?: string;
  /** Password field with a show/hide button. */
  secure?: boolean;
  trailing?: ReactNode;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** Design System §4 Input: label above, 48px field, help below, units at the end. */
export function Input({ label, help, error, unit, secure, trailing, ref, ...rest }: InputProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? t.colors.danger : focused ? t.colors.brand : t.colors.lineStrong;

  return (
    <View style={{ gap: 6 }}>
      <Text variant="sub" style={{ fontFamily: t.type.title3.fontFamily, fontSize: 14 }}>
        {label}
      </Text>
      <View
        style={{
          minHeight: 48,
          borderWidth: focused || error ? 2 : 1,
          borderColor,
          borderRadius: t.radius.md,
          backgroundColor: t.colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: focused || error ? t.space.s4 - 1 : t.space.s4,
          paddingRight: t.space.s2,
        }}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? help}
          placeholderTextColor={t.colors.ink2}
          secureTextEntry={secure && hidden}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          maxFontSizeMultiplier={2}
          {...rest}
          style={{
            flex: 1,
            minHeight: 44,
            color: t.colors.ink,
            fontFamily: t.type.body.fontFamily,
            fontSize: t.type.body.fontSize,
            paddingVertical: 10,
          }}
        />
        {unit ? (
          <Text variant="body" color="ink2" style={{ marginHorizontal: t.space.s2 }}>
            {unit}
          </Text>
        ) : null}
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name={hidden ? 'visibility' : 'visibility_off'} color="ink2" />
          </Pressable>
        ) : null}
        {trailing}
      </View>
      {error || help ? (
        <Text variant="sub" color={error ? 'danger' : 'ink2'} accessibilityLiveRegion={error ? 'polite' : 'none'}>
          {error ?? help}
        </Text>
      ) : null}
    </View>
  );
}
