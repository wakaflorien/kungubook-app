import { Pressable, View } from 'react-native';
import { useTheme, type ColorName } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  icon?: string;
  selected?: boolean;
  /** Attention chips (Home only): each opens the screen that fixes the issue. */
  tone?: 'default' | 'warn' | 'danger';
  count?: number;
  onPress?: () => void;
}

/** 36px filter chip; the touch area is padded to 44px. */
export function Chip({ label, icon, selected, tone = 'default', count, onPress }: ChipProps) {
  const t = useTheme();
  const attention = tone !== 'default';
  const fg: ColorName = attention ? tone : selected ? 'brandStrong' : 'ink';
  const bold = attention || selected;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => ({
        height: 36,
        paddingHorizontal: 14,
        borderRadius: t.radius.full,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: attention ? 'transparent' : selected ? t.colors.brand : t.colors.lineStrong,
        backgroundColor: attention
          ? t.colors[tone === 'warn' ? 'warnSoft' : 'dangerSoft']
          : selected
            ? t.colors.brandSoft
            : pressed
              ? t.colors.surface2
              : t.colors.surface,
        opacity: pressed && attention ? 0.85 : 1,
      })}
    >
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text
        variant="sub"
        color={fg}
        style={{ fontSize: 14, fontFamily: bold ? t.type.title3.fontFamily : t.type.row.fontFamily }}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <View
          style={{
            minWidth: 20,
            height: 20,
            borderRadius: t.radius.full,
            backgroundColor: t.colors.ink,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 5,
          }}
        >
          <Text variant="badge" color="surface" tabular>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
