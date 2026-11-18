import { describe, expect, it } from 'vitest';
import { amortize, formatMoney, MINUS, parseMoney } from './index';

describe('formatMoney', () => {
  it('formats RWF with no decimals and comma thousands', () => {
    expect(formatMoney(3_480_000, 'RWF')).toBe('RWF 3,480,000');
    expect(formatMoney(0, 'RWF')).toBe('RWF 0');
    expect(formatMoney(999, 'rwf')).toBe('RWF 999');
  });

  it('formats two-decimal currencies from minor units', () => {
    expect(formatMoney(125_050, 'USD')).toBe('USD 1,250.50');
    expect(formatMoney(5, 'USD')).toBe('USD 0.05');
  });

  it('uses U+2212 for negatives and direction signs', () => {
    expect(formatMoney(-152_500, 'RWF')).toBe(`${MINUS}RWF 152,500`);
    expect(formatMoney(152_500, 'RWF', { sign: 'out' })).toBe(`${MINUS}RWF 152,500`);
    expect(formatMoney(50_000, 'RWF', { sign: 'in' })).toBe('+RWF 50,000');
    expect(formatMoney(122_200, 'RWF', { sign: 'always' })).toBe('+RWF 122,200');
    expect(formatMoney(-10, 'RWF', { sign: 'none' })).toBe('RWF 10');
  });

  it('compacts summary figures like the design', () => {
    expect(formatMoney(1_630_000, 'RWF', { compact: true })).toBe('RWF 1.63M');
    expect(formatMoney(820_900, 'RWF', { compact: true })).toBe('RWF 821K');
    expect(formatMoney(122_200, 'RWF', { compact: true, sign: 'always' })).toBe('+RWF 122K');
    expect(formatMoney(3_000_000, 'RWF', { compact: true })).toBe('RWF 3M');
    expect(formatMoney(999_700, 'RWF', { compact: true })).toBe('RWF 1M');
    expect(formatMoney(950, 'RWF', { compact: true })).toBe('RWF 950');
  });

  it('rejects non-integer minor units', () => {
    expect(() => formatMoney(1.5, 'RWF')).toThrow(TypeError);
  });
});

describe('parseMoney', () => {
  it('parses typed RWF amounts', () => {
    expect(parseMoney('1,250,000', 'RWF')).toBe(1_250_000);
    expect(parseMoney('RWF 18 500', 'RWF')).toBe(18_500);
    expect(parseMoney('  62600 ', 'RWF')).toBe(62_600);
    expect(parseMoney('1,000.00', 'RWF')).toBe(1_000);
  });

  it('parses decimals into minor units', () => {
    expect(parseMoney('12.5', 'USD')).toBe(1_250);
    expect(parseMoney('USD 1,250.50', 'USD')).toBe(125_050);
  });

  it('handles signs, including U+2212', () => {
    expect(parseMoney(`${MINUS}RWF 152,500`, 'RWF')).toBe(-152_500);
    expect(parseMoney('+50000', 'RWF')).toBe(50_000);
  });

  it('round-trips with formatMoney', () => {
    for (const v of [0, 1, 999, 3_480_000, -152_500]) {
      expect(parseMoney(formatMoney(v, 'RWF'), 'RWF')).toBe(v);
    }
  });

  it('returns null for text that is not an amount', () => {
    expect(parseMoney('', 'RWF')).toBeNull();
    expect(parseMoney('abc', 'RWF')).toBeNull();
    expect(parseMoney('12.5', 'RWF')).toBeNull();
    expect(parseMoney('1.234', 'USD')).toBeNull();
  });
});

describe('amortize', () => {
  const bk = amortize(5_000_000, 1450, 42);

  it('reproduces the BK Term Loan reference (doc 05 §4)', () => {
    expect(bk.installment).toBe(152_500);
    expect(bk.balanceAfter(18)).toBe(3_160_800);
    expect(bk.installment * 18).toBe(2_745_000);
  });

  it('builds a full schedule that ends at zero', () => {
    expect(bk.schedule).toHaveLength(42);
    expect(bk.schedule.at(-1)!.balance).toBe(0);
    expect(bk.balanceAfter(0)).toBe(5_000_000);
    for (const i of bk.schedule) expect(i.interest + i.principal).toBe(i.payment);
    expect(bk.totalPaid - bk.totalInterest).toBe(5_000_000);
  });

  it('splits a zero-interest loan evenly, rounded to 100', () => {
    const z = amortize(120_000, 0, 4);
    expect(z.installment).toBe(30_000);
    expect(z.totalPaid).toBe(120_000);
    expect(z.totalInterest).toBe(0);
  });

  it('accepts an installment override', () => {
    const o = amortize(5_000_000, 1450, 42, 200_000);
    expect(o.installment).toBe(200_000);
    expect(o.schedule.length).toBeLessThan(42);
    expect(o.schedule.at(-1)!.balance).toBe(0);
  });

  it('rejects invalid input', () => {
    expect(() => amortize(0, 1450, 42)).toThrow(RangeError);
    expect(() => amortize(1_000, 1450, 0)).toThrow(RangeError);
  });
});
