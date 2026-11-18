import { Pressable, View } from 'react-native';
import { useTheme, type ColorName } from '../theme';
import { Icon } from './Icon';

export interface IconButtonProps {
  icon: string;
  /** Required: icon-only buttons always have an accessibility label. */
  label: string;
  onPress?: () => void;
  color?: ColorName;
  /** Bordered surface circle (used on sheets). */
  boxed?: boolean;
  /** Red dot for unread items. */
  dot?: boolean;
}

/** 44 × 44 round icon button. */
export function IconButton({ icon, label, onPress, color = 'ink', boxed, dot }: IconButtonProps) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: t.radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? t.colors.surface2 : boxed ? t.colors.surface : 'transparent',
        borderWidth: boxed ? 1 : 0,
        borderColor: t.colors.line,
      })}
    >
      <Icon name={icon} color={color} />
      {dot ? (
        <View
          style={{
            position: 'absolute',
            top: 9,
            right: 10,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: t.colors.danger,
            borderWidth: 2,
            borderColor: t.colors.surface,
          }}
        />
      ) : null}
    </Pressable>
  );
}
