import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type AppEnv = 'mock' | 'staging' | 'production';

interface Extra {
  appEnv?: AppEnv;
  apiBaseUrl?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function resolveBaseUrl(): string {
  const url = extra.apiBaseUrl ?? 'http://localhost:4010';
  // The Android emulator reaches the host machine at 10.0.2.2, not localhost.
  return Platform.OS === 'android' ? url.replace('://localhost', '://10.0.2.2') : url;
}

export const env = {
  appEnv: extra.appEnv ?? 'mock',
  apiBaseUrl: resolveBaseUrl(),
  appVersion: Constants.expoConfig?.version ?? '0.0.0',
  platform: Platform.OS,
} as const;
