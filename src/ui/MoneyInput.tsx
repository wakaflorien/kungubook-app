import { formatMoney, minorUnits, parseMoney } from '../lib/money';
import { Input, type InputProps } from './Input';

export interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChangeText' | 'unit' | 'keyboardType'> {
  currency: string;
  /** What the user typed, kept as text so they can edit freely. */
  text: string;
  onChangeText: (text: string) => void;
}

/** Strips everything but digits (and one decimal point where the currency has decimals), then groups thousands. */
export function formatAmountText(raw: string, currency: string) {
  const decimals = minorUnits(currency);
  const cleaned = raw.replace(decimals ? /[^\d.]/g : /\D/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimals && rest.length ? `${grouped}.${rest.join('').slice(0, decimals)}` : grouped;
}

/** Minor units for the typed text, or null when empty or invalid. */
export const amountFromText = (text: string, currency: string) =>
  text.trim() === '' ? null : parseMoney(text, currency);

/** Text for an amount in minor units ("1,240,000"), for editing. */
export const textFromAmount = (minor: number, currency: string) =>
  formatMoney(minor, currency, { sign: 'none' }).replace(/^[A-Z]{3} /, '');

/** Amount field: number keyboard, live thousands separators, the currency at the end. */
export function MoneyInput({ currency, text, onChangeText, ...rest }: MoneyInputProps) {
  return (
    <Input
      {...rest}
      unit={currency}
      value={text}
      keyboardType={minorUnits(currency) ? 'decimal-pad' : 'number-pad'}
      onChangeText={(raw) => onChangeText(formatAmountText(raw, currency))}
    />
  );
}
