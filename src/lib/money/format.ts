import { minorUnits } from './currency';

/** U+2212 MINUS SIGN — the design system never uses a hyphen for money. */
export const MINUS = '−';

export type MoneyDirection = 'in' | 'out';

export interface FormatMoneyOptions {
  /** `RWF 1.63M`, `RWF 821K`. Only on summary cards. */
  compact?: boolean;
  /**
   * How to show the sign:
   * - `auto` (default): `−` for negative values only.
   * - `always`: `+` or `−` (zero gets no sign).
   * - `in` / `out`: direction of a positive amount (`+` / `−`), as stored in `kind`.
   * - `none`: absolute value, no sign.
   */
  sign?: 'auto' | 'always' | 'none' | MoneyDirection;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function trimZeros(fixed: string): string {
  return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
}

function compactMajor(major: number): string {
  if (major >= 1_000_000_000) return `${trimZeros((major / 1_000_000_000).toFixed(2))}B`;
  if (major >= 1_000_000) return `${trimZeros((major / 1_000_000).toFixed(2))}M`;
  if (major >= 1_000) {
    const k = Math.round(major / 1_000);
    return k >= 1_000 ? `${trimZeros((major / 1_000_000).toFixed(2))}M` : `${k}K`;
  }
  return groupThousands(String(Math.round(major)));
}

/**
 * Format an integer amount in minor units: `formatMoney(1250000, 'RWF')` → `RWF 1,250,000`.
 * The single place money is turned into text (Design System §7).
 */
export function formatMoney(minor: number, currency: string, options: FormatMoneyOptions = {}): string {
  if (!Number.isInteger(minor)) throw new TypeError(`formatMoney expects integer minor units, got ${minor}`);
  const { compact = false, sign = 'auto' } = options;
  const code = currency.toUpperCase();
  const decimals = minorUnits(code);
  const abs = Math.abs(minor);

  let body: string;
  if (compact) {
    body = compactMajor(abs / 10 ** decimals);
  } else if (decimals === 0) {
    body = groupThousands(String(abs));
  } else {
    const s = String(abs).padStart(decimals + 1, '0');
    body = `${groupThousands(s.slice(0, -decimals))}.${s.slice(-decimals)}`;
  }

  let prefix = '';
  if (sign === 'in') prefix = '+';
  else if (sign === 'out') prefix = MINUS;
  else if (sign === 'always') prefix = minor > 0 ? '+' : minor < 0 ? MINUS : '';
  else if (sign === 'auto') prefix = minor < 0 ? MINUS : '';

  return `${prefix}${code} ${body}`;
}
