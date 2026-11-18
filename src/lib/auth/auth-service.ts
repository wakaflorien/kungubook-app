import type { KunguBookClient, Session, TokenStore } from '../../api/client';
import { unwrap } from '../../api/client';
import { ApiError } from '../../api/errors';

export interface SignUpInput {
  email: string;
  password: string;
  displayName?: string;
  timezone?: string;
}

/**
 * Sign-up, sign-in (email, Apple, Google), password recovery and sign-out against the API.
 * Every successful sign-in stores the token pair; the API client then refreshes it on `401 token_expired`.
 */
export function createAuthService(api: KunguBookClient, tokens: TokenStore) {
  const keep = async (session: Session) => {
    await tokens.set({ accessToken: session.access_token, refreshToken: session.refresh_token });
    return session;
  };

  return {
    async signUp({ email, password, displayName, timezone = 'Africa/Kigali' }: SignUpInput) {
      const session = await unwrap(
        api.POST('/auth/signup', {
          body: {
            email: email.trim(),
            password,
            display_name: displayName?.trim() || email.trim().split('@')[0]!,
            timezone,
          },
        }),
      );
      return keep(session);
    },

    async signIn(email: string, password: string) {
      return keep(await unwrap(api.POST('/auth/login', { body: { email: email.trim(), password } })));
    },

    /** `identityToken` from Sign in with Apple on the device. */
    async signInWithApple(identityToken: string) {
      return keep(await unwrap(api.POST('/auth/apple', { body: { identity_token: identityToken } })));
    },

    /** `idToken` from Google sign-in on the device. */
    async signInWithGoogle(idToken: string) {
      return keep(await unwrap(api.POST('/auth/google', { body: { id_token: idToken } })));
    },

    /** Always resolves the same way whether or not the account exists (no account probing). */
    async forgotPassword(email: string) {
      await unwrap(api.POST('/auth/password/forgot', { body: { email: email.trim() } }));
    },

    async resetPassword(token: string, password: string) {
      await unwrap(api.POST('/auth/password/reset', { body: { token, password } }));
    },

    /** For "Forgot PIN": true when the password is right, false when it is wrong; other errors throw. */
    async verifyPassword(password: string): Promise<boolean> {
      try {
        await unwrap(api.POST('/auth/verify-password', { body: { password } }));
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.code === 'invalid_credentials') return false;
        throw e;
      }
    },

    /** Revokes the refresh token on the server when possible, then forgets the tokens locally. */
    async signOut() {
      const current = await tokens.get();
      try {
        if (current) await unwrap(api.POST('/auth/logout', { body: { refresh_token: current.refreshToken } }));
      } catch {
        // Offline or already revoked: signing out locally is what matters.
      } finally {
        await tokens.clear();
      }
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

/** What to tell the user for an auth error (Design System §5: say what happened and what to do). */
export function authErrorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Try again.';
  switch (e.code) {
    case 'invalid_credentials':
      return "That password doesn't match. Try again or reset it.";
    case 'email_taken':
      return 'An account with this email already exists. Sign in instead.';
    case 'validation_failed':
      return Object.values(e.fields ?? {})[0] ?? 'Check the details and try again.';
    case 'link_expired':
      return 'This reset link has expired. Ask for a new one.';
    case 'rate_limited':
      return 'Too many attempts. Wait a minute, then try again.';
    case 'network':
      return "Can't reach KunguBook. Check your connection and try again.";
    case 'upgrade_required':
      return 'This version of KunguBook is too old. Update the app to continue.';
    default:
      return 'Something went wrong on our side. Try again in a moment.';
  }
}
