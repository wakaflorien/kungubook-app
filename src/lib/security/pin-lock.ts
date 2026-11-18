import { argon2idAsync } from '@noble/hashes/argon2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { getJson, setJson, type KeyValueStore } from '../storage';

/** The app PIN is 4 digits (screen 26). */
export const PIN_LENGTH = 4;
export const isValidPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

/** Failed attempts before each wait; the wait doubles every round. */
export const ATTEMPTS_PER_ROUND = 5;
export const FIRST_WAIT_MS = 30_000;
/** After this many failures the PIN stops working and the account password is needed (Forgot PIN, 74). */
export const MAX_FAILED_ATTEMPTS = 10;

/** Legacy argon2id settings (records written before 2026-11-19 still verify with their stored params). */
export interface HashParams {
  t: number;
  m: number;
  p: number;
}

/** A SHA-256 implementation: native (expo-crypto) in the app, WebCrypto or JS in tests. */
export type Digest = (data: Uint8Array) => Promise<Uint8Array>;

/**
 * New PINs: salted SHA-256 iterated `ITERATIONS` times, each round `sha256(previous || salt)`.
 * The app runs it through expo-crypto's native digest, asynchronously, so the keypad never freezes.
 * argon2id in JavaScript blocked the JS thread for seconds on Hermes (2–8 s in debug builds), which made
 * taps queue up on the lock screen. A 4-digit PIN has only 10,000 values, so hashing cost can't protect it
 * offline anyway: the real protection is the Keychain/Keystore holding the hash plus the attempt limits below.
 */
export const ITERATIONS = 1000;

type PinRecord =
  | { v: 1; salt: string; hash: string; params: HashParams }
  | { v: 2; alg: 'sha256-iter'; salt: string; hash: string; iterations: number };

interface AttemptState {
  failed: number;
  lockedUntil: number | null;
}

const PIN_KEY = 'security.pin';
const ATTEMPTS_KEY = 'security.pin_attempts';

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: 'no_pin' }
  | { ok: false; reason: 'wrong'; attemptsLeft: number; lockedUntil: number | null }
  | { ok: false; reason: 'locked'; lockedUntil: number }
  | { ok: false; reason: 'password_required' };

export interface PinLockOptions {
  now?: () => number;
  randomBytes?: (n: number) => Uint8Array;
  /** SHA-256. Defaults to WebCrypto when available, else a JS implementation. */
  digest?: Digest;
  iterations?: number;
}

const concat = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

const defaultDigest: Digest = async (data) => {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) return new Uint8Array(await subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>));
  return sha256(data);
};

/** Salted, iterated SHA-256 of the PIN, as hex. */
export async function hashPin(pin: string, salt: Uint8Array, iterations = ITERATIONS, digest: Digest = defaultDigest) {
  let h = await digest(concat(salt, new TextEncoder().encode(pin)));
  for (let i = 1; i < iterations; i++) h = await digest(concat(h, salt));
  return bytesToHex(h);
}

async function legacyArgon2(pin: string, salt: Uint8Array, params: HashParams) {
  return bytesToHex(await argon2idAsync(pin, salt, { ...params, dkLen: 32 }));
}

/** Constant-time comparison of two hex strings. */
function sameHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const defaultRandom = (n: number) => {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * The app lock PIN: stored as a salted, iterated SHA-256 hash in secure storage, never in plain text.
 * Wrong attempts are counted across restarts: every 5 failures add a wait (30 s, 60 s, …),
 * and after 10 the PIN is disabled until the user confirms their account password.
 */
export function createPinLock(store: KeyValueStore, options: PinLockOptions = {}) {
  const now = options.now ?? Date.now;
  const randomBytes = options.randomBytes ?? defaultRandom;
  const digest = options.digest ?? defaultDigest;
  const iterations = options.iterations ?? ITERATIONS;

  const hashFor = (pin: string, record: PinRecord) =>
    record.v === 1
      ? legacyArgon2(pin, hexToBytes(record.salt), record.params)
      : hashPin(pin, hexToBytes(record.salt), record.iterations, digest);

  const attempts = async (): Promise<AttemptState> =>
    (await getJson<AttemptState>(store, ATTEMPTS_KEY)) ?? { failed: 0, lockedUntil: null };

  return {
    async hasPin() {
      return (await store.getItem(PIN_KEY)) !== null;
    },

    async setPin(pin: string) {
      if (!isValidPin(pin)) throw new RangeError(`The PIN must be ${PIN_LENGTH} digits`);
      const salt = randomBytes(16);
      const record: PinRecord = {
        v: 2,
        alg: 'sha256-iter',
        salt: bytesToHex(salt),
        hash: await hashPin(pin, salt, iterations, digest),
        iterations,
      };
      await setJson(store, PIN_KEY, record);
      await store.deleteItem(ATTEMPTS_KEY);
    },

    async verify(pin: string): Promise<VerifyResult> {
      const record = await getJson<PinRecord>(store, PIN_KEY);
      if (!record) return { ok: false, reason: 'no_pin' };

      const state = await attempts();
      if (state.failed >= MAX_FAILED_ATTEMPTS) return { ok: false, reason: 'password_required' };
      if (state.lockedUntil && now() < state.lockedUntil)
        return { ok: false, reason: 'locked', lockedUntil: state.lockedUntil };

      const candidate = isValidPin(pin) ? await hashFor(pin, record) : '';
      if (candidate && sameHex(candidate, record.hash)) {
        await store.deleteItem(ATTEMPTS_KEY);
        return { ok: true };
      }

      const failed = state.failed + 1;
      if (failed >= MAX_FAILED_ATTEMPTS) {
        await setJson(store, ATTEMPTS_KEY, { failed, lockedUntil: null });
        return { ok: false, reason: 'password_required' };
      }
      const round = Math.floor(failed / ATTEMPTS_PER_ROUND);
      const lockedUntil = failed % ATTEMPTS_PER_ROUND === 0 ? now() + FIRST_WAIT_MS * 2 ** (round - 1) : null;
      await setJson(store, ATTEMPTS_KEY, { failed, lockedUntil });
      const attemptsLeft = ATTEMPTS_PER_ROUND - (failed % ATTEMPTS_PER_ROUND);
      return { ok: false, reason: 'wrong', attemptsLeft: lockedUntil ? 0 : attemptsLeft, lockedUntil };
    },

    /** Current wait, if any (for the lock screen countdown). */
    async lockedUntil(): Promise<number | null> {
      const s = await attempts();
      return s.lockedUntil && now() < s.lockedUntil ? s.lockedUntil : null;
    },

    async passwordRequired() {
      return (await attempts()).failed >= MAX_FAILED_ATTEMPTS;
    },

    async clear() {
      await store.deleteItem(PIN_KEY);
      await store.deleteItem(ATTEMPTS_KEY);
    },
  };
}

export type PinLock = ReturnType<typeof createPinLock>;
