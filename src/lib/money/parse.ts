import { minorUnits } from './currency';

/**
 * Parse what a user typed into integer minor units.
 * `parseMoney('1,250,000', 'RWF')` → `1250000`; `parseMoney('12.5', 'USD')` → `1250`.
 * Accepts an optional currency code, spaces, thousands commas and a leading sign.
 * Returns `null` when the text is not an amount or has more decimals than the currency allows.
 */
export function parseMoney(input: string, currency: string): number | null {
  const code = currency.toUpperCase();
  const decimals = minorUnits(code);
  let s = input.trim().toUpperCase().replace(/−/g, '-');
  s = s.replace(new RegExp(`\\b${code}\\b`, 'g'), '').replace(/[\s, ]/g, '');

  const m = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(s);
  if (!m) return null;
  const [, signPart, whole, frac = ''] = m;
  if (frac.length > decimals) {
    // Allow trailing zeros beyond the precision ("1,000.00" for RWF).
    if (/[^0]/.test(frac.slice(decimals))) return null;
  }
  const fracPadded = frac.slice(0, decimals).padEnd(decimals, '0');
  const value = Number(`${whole}${fracPadded}`);
  if (!Number.isSafeInteger(value)) return null;
  return signPart === '-' ? -value : value;
}
