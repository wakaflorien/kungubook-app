import {
  DropdownMenuItem,
  ExposedDropdownMenu,
  ExposedDropdownMenuBox,
  Host,
  Text as ComposeText,
  OutlinedTextField,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { fillMaxWidth, menuAnchor } from '@expo/ui/jetpack-compose/modifiers';
import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import type { SelectProps } from './Select';
import { Text } from './Text';

/** Read-only Material text field showing the current choice. */
function SelectedField({ label }: { label: string }) {
  const t = useTheme();
  const shown = useNativeState(label);
  return (
    <OutlinedTextField
      value={shown}
      readOnly
      modifiers={[menuAnchor(), fillMaxWidth()]}
      colors={{
        focusedIndicatorColor: t.colors.brand,
        unfocusedIndicatorColor: t.colors.lineStrong,
        focusedContainerColor: t.colors.surface,
        unfocusedContainerColor: t.colors.surface,
        focusedTextColor: t.colors.ink,
        unfocusedTextColor: t.colors.ink,
      }}
    >
      <OutlinedTextField.TrailingIcon>
        <ComposeText color={t.colors.ink2} style={{ fontSize: 20 }}>
          ▾
        </ComposeText>
      </OutlinedTextField.TrailingIcon>
    </OutlinedTextField>
  );
}

/** Android: a Material 3 exposed dropdown menu (read-only field that opens the list below it). */
export function Select<T extends string>({ label, value, options, onChange, help }: SelectProps<T>) {
  const t = useTheme();
  const [expanded, setExpanded] = useState(false);
  const currentLabel = options.find((o) => o.value === value)?.label ?? '';

  return (
    <View style={{ gap: 6 }}>
      <Text variant="sub" style={{ fontFamily: t.type.title3.fontFamily, fontSize: 14 }}>
        {label}
      </Text>
      {/* Keyed by the label: a new selection remounts the field with it (no native-state mutation). */}
      <Host key={currentLabel} matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }}>
        <ExposedDropdownMenuBox expanded={expanded} onExpandedChange={setExpanded}>
          <SelectedField label={currentLabel} />
          <ExposedDropdownMenu expanded={expanded} onDismissRequest={() => setExpanded(false)}>
            {options.map((o) => (
              <DropdownMenuItem
                key={o.value}
                onClick={() => {
                  onChange(o.value);
                  setExpanded(false);
                }}
              >
                <DropdownMenuItem.Text>
                  <ComposeText>{o.detail ? `${o.label} · ${o.detail}` : o.label}</ComposeText>
                </DropdownMenuItem.Text>
              </DropdownMenuItem>
            ))}
          </ExposedDropdownMenu>
        </ExposedDropdownMenuBox>
      </Host>
      {help ? (
        <Text variant="sub" color="ink2">
          {help}
        </Text>
      ) : null}
    </View>
  );
}
