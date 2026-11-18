import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

/**
 * Apple and Google sign-in on the device. Each returns the provider's token, which the app sends to the API
 * (POST /auth/apple, /auth/google); the API verifies it. Returns null when the user cancels.
 *
 * Setup the user must do (see README → Sign in with Apple / Google):
 * - Apple: enable the capability for app.kungubook.mobile; works in a dev build, and in Expo Go on iOS.
 * - Google: create OAuth client IDs and set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
 *   and GOOGLE_IOS_URL_SCHEME. Google sign-in needs a dev build; Expo Go does not contain its native module.
 */
export class SignInUnavailableError extends Error {}

export async function appleSignInAvailable() {
  return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
}

export async function signInWithApple(): Promise<string | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new SignInUnavailableError('Apple did not return a sign-in token.');
    return credential.identityToken;
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

/** Loaded lazily: in Expo Go the native module is missing and importing it would crash the app. */
function loadGoogle(): GoogleModule | null {
  if (!GOOGLE_WEB_CLIENT_ID) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const google = require('@react-native-google-signin/google-signin') as GoogleModule;
    google.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
    return google;
  } catch {
    return null;
  }
}

let google: GoogleModule | null | undefined;

export async function signInWithGoogle(): Promise<string | null> {
  google ??= loadGoogle();
  if (!google) {
    throw new SignInUnavailableError(
      "Google sign-in isn't set up in this build yet. Use your email, or try Apple on iPhone.",
    );
  }
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = google;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null;
    if (!response.data.idToken) throw new SignInUnavailableError('Google did not return a sign-in token.');
    return response.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return null;
    throw e;
  }
}
