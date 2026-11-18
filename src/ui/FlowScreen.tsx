import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { HeaderActions } from './nativeHeader';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

export interface StepperProps {
  step: number;
  total: number;
  label: string;
}

/** Native progress bar plus "Step N of 6 · Label". */
export function Stepper({ step, total, label }: StepperProps) {
  const t = useTheme();
  return (
    <View style={{ gap: t.space.s2 }}>
      <ProgressBar value={step / total} accessibilityLabel={`Step ${step} of ${total}, ${label}`} />
      <Text variant="sub" color="ink2">
        Step {step} of {total} · {label}
      </Text>
    </View>
  );
}

export interface FlowScreenProps {
  title: string;
  /**
   * With `backIcon="close"`: a ✕ in the header (glass toolbar on iOS) that calls `onBack`.
   * Otherwise the native back button and swipe-back handle going back.
   */
  onBack?: () => void;
  backIcon?: 'back' | 'close';
  stepper?: StepperProps;
  children: ReactNode;
  /** The one primary button (and an optional ghost one), pinned to the bottom. */
  footer?: ReactNode;
  /** Center the content vertically (PIN screens). */
  centered?: boolean;
}

/** Flows and forms under a native header: stepper, scrolling content, primary action pinned to the bottom. */
export function FlowScreen({ title, onBack, backIcon = 'back', stepper, children, footer, centered }: FlowScreenProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const close = backIcon === 'close' && onBack;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: t.colors.bg }}
    >
      <Stack.Screen options={{ title, headerBackVisible: !close }} />
      {close ? <HeaderActions left={[{ sf: 'xmark', icon: 'close', label: 'Close', onPress: close }]} /> : null}
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, padding: t.space.s4, paddingBottom: t.space.s6 }}
      >
        <View style={{ flexGrow: 1, gap: t.space.s5, justifyContent: centered ? 'center' : 'flex-start' }}>
          {stepper ? <Stepper {...stepper} /> : null}
          {children}
        </View>
      </ScrollView>
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
