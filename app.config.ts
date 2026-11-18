import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One app, three API environments (TRD §10). Pick with APP_ENV (EAS profiles set it):
 *   mock (default)  → Prism on http://localhost:4010 (`pnpm mock`)
 *   staging         → https://staging-api.kungubook.app/v1
 *   production      → https://api.kungubook.app/v1
 * EXPO_PUBLIC_API_URL overrides the URL (e.g. your Mac's LAN IP for a physical phone).
 */
export type AppEnv = 'mock' | 'staging' | 'production';

const API_URLS: Record<AppEnv, string> = {
  mock: 'http://localhost:4010',
  staging: 'https://staging-api.kungubook.app/v1',
  production: 'https://api.kungubook.app/v1',
};

const appEnv = (process.env.APP_ENV ?? 'mock') as AppEnv;
if (!(appEnv in API_URLS)) throw new Error(`APP_ENV must be mock, staging or production (got "${appEnv}")`);

const VERSION = '0.1.0';
const FACE_ID_REASON = 'KunguBook uses Face ID to unlock the app instead of your PIN.';
/** Reversed iOS client ID, e.g. com.googleusercontent.apps.123-abc. */
const GOOGLE_IOS_URL_SCHEME = process.env.GOOGLE_IOS_URL_SCHEME;
/** Created by `eas init` on 2026-11-18 under the wakaflorien Expo account. */
const EAS_PROJECT_ID = '40b72ba3-0123-4dc5-9f41-50bc95366243';
const suffix = appEnv === 'production' ? '' : ` (${appEnv})`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `KunguBook${suffix}`,
  owner: 'wakaflorien',
  slug: 'kungubook',
  scheme: 'kungubook',
  version: VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'app.kungubook.mobile',
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      // The mock server is plain HTTP on localhost.
      NSAppTransportSecurity: appEnv === 'mock' ? { NSAllowsLocalNetworking: true } : undefined,
    },
  },
  android: {
    package: 'app.kungubook.mobile',
    adaptiveIcon: {
      backgroundColor: '#047857',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        backgroundColor: '#F4F7F6',
        dark: { backgroundColor: '#0A0F14' },
      },
    ],
    // Encrypted local cache (TRD §8). Needs a dev or store build; Expo Go uses plain SQLite.
    ['expo-sqlite', { useSQLCipher: true }],
    ['expo-secure-store', { faceIDPermission: FACE_ID_REASON }],
    ['expo-local-authentication', { faceIDPermission: FACE_ID_REASON }],
    'expo-apple-authentication',
    ['expo-notifications', { color: '#047857' }],
    // Google sign-in: added once the OAuth client exists (README → Sign in with Google).
    ...(GOOGLE_IOS_URL_SCHEME
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: GOOGLE_IOS_URL_SCHEME }] as [string, object]]
      : []),
  ],
  extra: {
    appEnv,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? API_URLS[appEnv],
    // Links the app to its EAS project (https://expo.dev/accounts/wakaflorien/projects/kungubook).
    // Not a secret: EAS Build, Update and push notifications read it from here.
    eas: { projectId: EAS_PROJECT_ID },
  },
});
