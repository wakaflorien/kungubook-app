/** Default idle time before the app locks again (TRD §8). Changeable in Settings → Security (M6). */
export const DEFAULT_AUTO_LOCK_MS = 60_000;

/**
 * Decides when the app locks: always on a cold start, and on return to the foreground
 * after `idleMs` or more in the background. Pure, so the timing rules are unit-tested.
 */
export function createAutoLock({ idleMs = DEFAULT_AUTO_LOCK_MS, now = Date.now } = {}) {
  let backgroundedAt: number | null = null;
  return {
    /** The app went to the background (or the app switcher). */
    onBackground() {
      backgroundedAt ??= now();
    },
    /** The app is active again. Returns true when it must show the lock screen. */
    onForeground(): boolean {
      const since = backgroundedAt;
      backgroundedAt = null;
      return since !== null && now() - since >= idleMs;
    },
  };
}

export type AppStatus = 'booting' | 'signedOut' | 'onboarding' | 'locked' | 'ready';

/** Where a cold start lands, from what is stored on the phone. */
export function initialStatus(s: { hasTokens: boolean; onboarded: boolean; hasPin: boolean }): AppStatus {
  if (!s.hasTokens) return 'signedOut';
  if (!s.onboarded || !s.hasPin) return 'onboarding';
  return 'locked';
}
