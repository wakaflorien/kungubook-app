import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, type ColorName } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  /** A verb: "Save expense", "Import 38 transactions". */
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  /** `sm` is 44px high; default is 48px. */
  size?: 'md' | 'sm';
  icon?: string;
  block?: boolean;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** One primary per screen; danger is outline only; ghost for "Not now". */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  block,
  disabled,
  loading,
  style,
}: ButtonProps) {
  const t = useTheme();
  const fg: ColorName = { primary: 'onBrand', secondary: 'ink', ghost: 'brand', danger: 'danger' }[
    variant
  ] as ColorName;
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        {
          minHeight: size === 'sm' ? 44 : 48,
          paddingHorizontal: size === 'sm' ? t.space.s4 : t.space.s5,
          borderRadius: t.radius.md,
          borderWidth: 1,
          borderColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: t.space.s2,
          alignSelf: block ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.45 : 1,
        },
        variant === 'primary' && { backgroundColor: pressed ? t.colors.brandStrong : t.colors.brand },
        variant === 'secondary' && {
          backgroundColor: pressed ? t.colors.surface2 : t.colors.surface,
          borderColor: t.colors.lineStrong,
        },
        variant === 'ghost' && pressed && { backgroundColor: t.colors.brandSoft },
        variant === 'danger' && {
          backgroundColor: pressed ? t.colors.dangerSoft : t.colors.surface,
          borderColor: t.colors.danger,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={t.colors[fg]} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.s2 }}>
          {icon ? <Icon name={icon} size={20} color={fg} /> : null}
          <Text
            variant="row"
            color={fg}
            style={{ fontFamily: t.type.title3.fontFamily, fontSize: size === 'sm' ? 15 : 16 }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
