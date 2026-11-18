import { describe, expect, it } from 'vitest';
import { memoryStore } from '../storage';
import { createAutoLock, initialStatus } from './auto-lock';
import { ATTEMPTS_PER_ROUND, FIRST_WAIT_MS, MAX_FAILED_ATTEMPTS, createPinLock, isValidPin } from './pin-lock';

/** Few iterations so the tests stay fast; production uses ITERATIONS. */
const FAST = 10;

function setup() {
  let clock = 1_000_000;
  const kv = memoryStore();
  let seed = 0;
  const pin = createPinLock(kv, {
    now: () => clock,
    iterations: FAST,
    randomBytes: (n) => new Uint8Array(n).map(() => (seed += 7) % 256),
  });
  return { kv, pin, advance: (ms: number) => (clock += ms) };
}

describe('PIN lock', () => {
  it('accepts exactly 4 digits', () => {
    expect(isValidPin('0420')).toBe(true);
    for (const bad of ['', '123', '12345', '12a4', ' 1234']) expect(isValidPin(bad)).toBe(false);
  });

  it('stores a salted hash, never the PIN itself', async () => {
    const { pin, kv } = setup();
    expect(await pin.hasPin()).toBe(false);
    await pin.setPin('2580');

    expect(await pin.hasPin()).toBe(true);
    const stored = Object.values(kv.dump()).join(' ');
    expect(stored).not.toContain('2580');
    expect(JSON.parse(kv.dump()['security.pin']!)).toMatchObject({ v: 2, alg: 'sha256-iter', iterations: FAST });
    await expect(pin.setPin('12')).rejects.toThrow(RangeError);
  });

  it('gives the same PIN a different hash each time it is set (random salt)', async () => {
    const { pin, kv } = setup();
    await pin.setPin('2580');
    const first = JSON.parse(kv.dump()['security.pin']!).hash;
    await pin.setPin('2580');
    expect(JSON.parse(kv.dump()['security.pin']!).hash).not.toBe(first);
  });

  it('unlocks with the right PIN and rejects a wrong one', async () => {
    const { pin } = setup();
    expect(await pin.verify('2580')).toEqual({ ok: false, reason: 'no_pin' });
    await pin.setPin('2580');
    expect(await pin.verify('2580')).toEqual({ ok: true });
    expect(await pin.verify('0000')).toEqual({ ok: false, reason: 'wrong', attemptsLeft: 4, lockedUntil: null });
  });

  it('makes the user wait after 5 wrong PINs, then allows more tries', async () => {
    const { pin, advance } = setup();
    await pin.setPin('2580');
    for (let i = 1; i < ATTEMPTS_PER_ROUND; i++) await pin.verify('1111');
    const fifth = await pin.verify('1111');
    expect(fifth).toMatchObject({ ok: false, reason: 'wrong', attemptsLeft: 0 });
    const until = (fifth as { lockedUntil: number }).lockedUntil;

    // Even the right PIN waits while locked.
    expect(await pin.verify('2580')).toEqual({ ok: false, reason: 'locked', lockedUntil: until });
    expect(await pin.lockedUntil()).toBe(until);

    advance(FIRST_WAIT_MS);
    expect(await pin.lockedUntil()).toBeNull();
    expect(await pin.verify('2580')).toEqual({ ok: true });
  });

  it('requires the account password after 10 wrong PINs, until a new PIN is set', async () => {
    const { pin, advance } = setup();
    await pin.setPin('2580');
    let last;
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      last = await pin.verify('9999');
      advance(FIRST_WAIT_MS * 4);
    }
    expect(last).toEqual({ ok: false, reason: 'password_required' });
    expect(await pin.verify('2580')).toEqual({ ok: false, reason: 'password_required' });
    expect(await pin.passwordRequired()).toBe(true);

    await pin.setPin('1357'); // after Forgot PIN (74)
    expect(await pin.passwordRequired()).toBe(false);
    expect(await pin.verify('1357')).toEqual({ ok: true });
  });

  it('still verifies PINs saved with the earlier argon2id scheme', async () => {
    const { hexToBytes } = await import('@noble/hashes/utils.js');
    const { argon2id } = await import('@noble/hashes/argon2.js');
    const { bytesToHex } = await import('@noble/hashes/utils.js');
    const salt = '0102030405060708090a0b0c0d0e0f10';
    const params = { t: 1, m: 64, p: 1 };
    const hash = bytesToHex(argon2id('2580', hexToBytes(salt), { ...params, dkLen: 32 }));
    const kv = memoryStore({ 'security.pin': JSON.stringify({ v: 1, salt, hash, params }) });
    const pin = createPinLock(kv);
    expect(await pin.verify('0000')).toMatchObject({ ok: false, reason: 'wrong' });
    expect(await pin.verify('2580')).toEqual({ ok: true });
  });

  it('hashes the same way with the native digest and with WebCrypto', async () => {
    const { hashPin } = await import('./pin-lock');
    const { sha256 } = await import('@noble/hashes/sha2.js');
    const salt = new Uint8Array(16).fill(9);
    const viaJs = await hashPin('2580', salt, 50, async (d) => sha256(d));
    expect(await hashPin('2580', salt, 50)).toBe(viaJs);
  });

  it('counts wrong attempts across app restarts', async () => {
    const { pin, kv } = setup();
    await pin.setPin('2580');
    await pin.verify('0000');
    const restarted = createPinLock(kv, { iterations: FAST });
    expect(await restarted.verify('0000')).toMatchObject({ reason: 'wrong', attemptsLeft: 3 });
  });

  it('forgets the PIN and the attempt count on clear (sign-out)', async () => {
    const { pin, kv } = setup();
    await pin.setPin('2580');
    await pin.verify('0000');
    await pin.clear();
    expect(kv.dump()).toEqual({});
  });
});

describe('auto-lock', () => {
  it('locks when the app comes back after the idle time', () => {
    let t = 0;
    const lock = createAutoLock({ idleMs: 60_000, now: () => t });
    lock.onBackground();
    t += 59_999;
    expect(lock.onForeground()).toBe(false);
    lock.onBackground();
    t += 60_000;
    expect(lock.onForeground()).toBe(true);
  });

  it('measures from the first background event and ignores a foreground without one', () => {
    let t = 0;
    const lock = createAutoLock({ idleMs: 1_000, now: () => t });
    expect(lock.onForeground()).toBe(false);
    lock.onBackground();
    t += 600;
    lock.onBackground(); // inactive → background
    t += 600;
    expect(lock.onForeground()).toBe(true);
  });

  it('picks the cold-start screen from what is stored', () => {
    expect(initialStatus({ hasTokens: false, onboarded: true, hasPin: true })).toBe('signedOut');
    expect(initialStatus({ hasTokens: true, onboarded: false, hasPin: false })).toBe('onboarding');
    expect(initialStatus({ hasTokens: true, onboarded: true, hasPin: false })).toBe('onboarding');
    expect(initialStatus({ hasTokens: true, onboarded: true, hasPin: true })).toBe('locked');
  });
});
