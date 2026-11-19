import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}

/**
 * Material 3 search bar for the top of a page (Android). The header search Android draws itself
 * can't use our colours, so its underline almost disappears; this one is ours end to end.
 * iOS keeps the native header search (`headerSearchBarOptions`).
 */
export function SearchBar({ value, onChangeText, placeholder }: SearchBarProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={{
        minHeight: 56,
        borderRadius: t.radius.full,
        borderWidth: focused ? 2 : 1,
        borderColor: focused ? t.colors.brand : t.colors.lineStrong,
        backgroundColor: t.colors.surface2,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: focused ? t.space.s4 - 1 : t.space.s4,
        paddingRight: t.space.s1,
        gap: t.space.s3,
      }}
    >
      <Icon name="search" color="ink2" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.colors.ink2}
        accessibilityLabel={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxFontSizeMultiplier={2}
        style={{
          flex: 1,
          minHeight: 48,
          color: t.colors.ink,
          fontFamily: t.type.body.fontFamily,
          fontSize: t.type.body.fontSize,
          paddingVertical: 10,
        }}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          onPress={() => onChangeText('')}
          style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="close" color="ink2" />
        </Pressable>
      ) : null}
    </View>
  );
}
