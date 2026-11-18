import { View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Tile, type TileTone } from './ListRow';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: string;
  title: string;
  /** One or two sentences. */
  body: string;
  /** One action. */
  action?: { label: string; onPress: () => void };
  tone?: TileTone;
}

export function EmptyState({ icon, title, body, action, tone = 'brand' }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        gap: t.space.s3,
        paddingVertical: t.space.s8,
        paddingHorizontal: t.space.s4,
      }}
    >
      <Tile icon={icon} tone={tone} size={72} round />
      <Text variant="title2" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      <Text variant="body" color="ink2" style={{ textAlign: 'center', maxWidth: 320 }}>
        {body}
      </Text>
      {action ? (
        <Button label={action.label} onPress={action.onPress} style={{ marginTop: t.space.s2, alignSelf: 'center' }} />
      ) : null}
    </View>
  );
}
