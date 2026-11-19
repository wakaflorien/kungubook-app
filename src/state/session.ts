import { create } from 'zustand';
import type { Session } from '../api';
import { api, apiEvents, auth, cache, kv, pinLock, queryClient, tokenStore } from '../config/api';
import { resetLocalData } from '../config/data';
import { initialStatus, type AppStatus } from '../lib/security/auto-lock';
import { getJson, setJson } from '../lib/storage';
import { registerDevice } from '../platform/push';

/** Onboarding steps after sign-up (US-01). Step 1 is the sign-up screen itself. */
export const ONBOARDING_STEPS = ['profile', 'accounts', 'reminders', 'capture', 'pin'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
/** "Step N of 6" for a step. */
export const stepNumber = (step: OnboardingStep) => ONBOARDING_STEPS.indexOf(step) + 2;

export interface Profile {
  name: string;
  email: string;
}

const KEYS = {
  step: 'onboarding.step',
  mode: 'onboarding.mode',
  profile: 'profile',
  biometrics: 'security.biometrics',
} as const;

/** `new`: the full onboarding. `returning`: signed in on this phone, so only the PIN is needed. */
export type OnboardingMode = 'new' | 'returning';

interface SessionState {
  status: AppStatus;
  profile: Profile | null;
  step: OnboardingStep;
  mode: OnboardingMode;
  biometricsEnabled: boolean;
  upgradeRequired: boolean;

  boot(): Promise<void>;
  signedIn(session: Session): Promise<void>;
  setProfile(profile: Profile): Promise<void>;
  goToStep(step: OnboardingStep): Promise<void>;
  /** Saves the PIN (and biometrics choice) and opens Home. Also used by Forgot PIN. */
  finishWithPin(pin: string, biometrics: boolean): Promise<void>;
  setBiometrics(enabled: boolean): Promise<void>;
  lock(): void;
  unlock(): void;
  signOut(): Promise<void>;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export const useSession = create<SessionState>()((set, get) => ({
  status: 'booting',
  profile: null,
  step: 'profile',
  mode: 'new',
  biometricsEnabled: false,
  upgradeRequired: false,

  async boot() {
    const [tokens, step, mode, profile, hasPin, biometrics] = await Promise.all([
      tokenStore.load(),
      kv.getItem(KEYS.step),
      kv.getItem(KEYS.mode),
      getJson<Profile>(kv, KEYS.profile),
      pinLock.hasPin(),
      kv.getItem(KEYS.biometrics),
    ]);
    const onboarded = step === 'done';
    set({
      status: initialStatus({ hasTokens: !!tokens, onboarded, hasPin }),
      profile,
      step: !onboarded && ONBOARDING_STEPS.includes(step as OnboardingStep) ? (step as OnboardingStep) : 'profile',
      mode: mode === 'returning' ? 'returning' : 'new',
      biometricsEnabled: biometrics === '1',
    });
  },

  async signedIn(session) {
    const profile = {
      name: session.user.display_name ?? session.user.email.split('@')[0] ?? '',
      email: session.user.email,
    };
    await setJson(kv, KEYS.profile, profile);
    // A new account goes through onboarding; an existing one only sets a PIN on this phone.
    const mode: OnboardingMode = session.is_new_user ? 'new' : 'returning';
    const step: OnboardingStep = mode === 'new' ? 'profile' : 'pin';
    await Promise.all([kv.setItem(KEYS.mode, mode), kv.setItem(KEYS.step, step)]);
    queryClient.clear();
    set({ profile, mode, step, status: 'onboarding' });
  },

  async setProfile(profile) {
    await setJson(kv, KEYS.profile, profile);
    set({ profile });
  },

  async goToStep(step) {
    await kv.setItem(KEYS.step, step);
    set({ step });
  },

  async finishWithPin(pin, biometrics) {
    await pinLock.setPin(pin);
    await kv.setItem(KEYS.biometrics, biometrics ? '1' : '0');
    await kv.setItem(KEYS.step, 'done');
    set({ biometricsEnabled: biometrics, status: 'ready' });
    void registerDevice(api, kv).catch(() => undefined);
  },

  async setBiometrics(enabled) {
    await kv.setItem(KEYS.biometrics, enabled ? '1' : '0');
    set({ biometricsEnabled: enabled });
  },

  lock() {
    if (get().status === 'ready') set({ status: 'locked' });
  },

  unlock() {
    if (get().status !== 'locked') return;
    set({ status: 'ready' });
    void registerDevice(api, kv).catch(() => undefined);
  },

  async signOut() {
    await auth.signOut();
    await Promise.all([pinLock.clear(), cache.wipe(), ...Object.values(KEYS).map((k) => kv.deleteItem(k))]);
    // The database file is gone; the next read re-creates it and the next sign-in downloads everything again.
    resetLocalData();
    queryClient.clear();
    set({ status: 'signedOut', profile: null, step: 'profile', mode: 'new', biometricsEnabled: false });
  },
}));

export const greetingName = (p: Profile | null) => (p ? firstName(p.name) : '');

// The API refused the refresh token: sign out everywhere on this phone.
apiEvents.onSignedOut = () => {
  if (useSession.getState().status !== 'signedOut') void useSession.getState().signOut();
};
apiEvents.onUpgradeRequired = () => useSession.setState({ upgradeRequired: true });
