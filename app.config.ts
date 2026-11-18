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
const suffix = appEnv === 'production' ? '' : ` (${appEnv})`;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `KunguBook${suffix}`,
  slug: 'kungubook',
  scheme: 'kungubook',
  version: VERSION,
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'app.kungubook.mobile',
    supportsTablet: false,
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
  ],
  extra: {
    appEnv,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? API_URLS[appEnv],
    // Set by `eas init` (user step). Left empty so nothing is linked to an Expo account yet.
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
