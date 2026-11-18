import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface BiometricInfo {
  available: boolean;
  /** "Face ID", "Touch ID", "fingerprint" or "face unlock", for labels. */
  label: string;
  /** Material Symbols icon name. */
  icon: string;
}

export async function biometricInfo(): Promise<BiometricInfo> {
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const label = Platform.OS === 'ios' ? (face ? 'Face ID' : 'Touch ID') : face ? 'face unlock' : 'fingerprint';
  return { available: hardware && enrolled, label, icon: face ? 'face' : 'fingerprint' };
}

/** Shows the system prompt. Resolves true only on a successful match. */
export async function authenticateWithBiometrics(promptMessage = 'Unlock KunguBook'): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Use PIN',
    disableDeviceFallback: true,
  });
  return result.success;
}
