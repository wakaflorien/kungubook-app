import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { AppBar } from './AppBar';
import { Text } from './Text';

export interface StepperProps {
  step: number;
  total: number;
  label: string;
}

/** Progress bars plus "Step N of 6 · Label". */
export function Stepper({ step, total, label }: StepperProps) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}, ${label}`}
      style={{ paddingHorizontal: t.space.s4, gap: 6 }}
    >
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: t.radius.full,
              backgroundColor: i < step ? t.colors.brand : t.colors.surface2,
            }}
          />
        ))}
      </View>
      <Text variant="sub" color="ink2">
        Step {step} of {total} · {label}
      </Text>
    </View>
  );
}

export interface FlowScreenProps {
  title: string;
  /** Back (sub-page arrow) or close (×). Omit to hide. */
  onBack?: () => void;
  backIcon?: 'back' | 'close';
  stepper?: StepperProps;
  children: ReactNode;
  /** The one primary button (and an optional ghost one), pinned to the bottom. */
  footer?: ReactNode;
  /** Center the content vertically (PIN screens). */
  centered?: boolean;
  scroll?: boolean;
  /** Presented as an iOS page-sheet modal: the sheet already sits below the status bar. */
  inModal?: boolean;
}

/** Flows and forms: app bar, optional stepper, scrolling content, primary action pinned to the bottom. */
export function FlowScreen({
  title,
  onBack,
  backIcon = 'back',
  stepper,
  children,
  footer,
  centered,
  scroll = true,
  inModal,
}: FlowScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const content = (
    <View style={{ flexGrow: 1, gap: t.space.s5, justifyContent: centered ? 'center' : 'flex-start' }}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{
        flex: 1,
        backgroundColor: t.colors.bg,
        paddingTop: inModal && Platform.OS === 'ios' ? t.space.s2 : insets.top,
      }}
    >
      {onBack ? (
        <AppBar title={title} variant={backIcon === 'close' ? 'flow' : 'sub'} onBack={onBack} />
      ) : (
        <View style={{ minHeight: 52, justifyContent: 'center', alignItems: 'center' }}>
          <Text variant="title3" accessibilityRole="header">
            {title}
          </Text>
        </View>
      )}
      {stepper ? <Stepper {...stepper} /> : null}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, padding: t.space.s4, paddingBottom: t.space.s6 }}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: t.space.s4 }}>{content}</View>
      )}
      {footer ? (
        <View
          style={{
            paddingHorizontal: t.space.s4,
            paddingTop: t.space.s3,
            paddingBottom: Math.max(insets.bottom, t.space.s4),
            gap: t.space.s2,
            borderTopWidth: 1,
            borderTopColor: t.colors.line,
            backgroundColor: t.colors.bg,
          }}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
