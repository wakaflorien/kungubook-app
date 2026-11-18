/** Decimal places (ISO 4217 minor units) for the currencies KunguBook shows. Unknown codes default to 2. */
const MINOR_UNITS: Record<string, number> = {
  RWF: 0,
  UGX: 0,
  BIF: 0,
  JPY: 0,
  KES: 2,
  TZS: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  CNY: 2,
  AED: 2,
  ZAR: 2,
};

export function minorUnits(currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 2;
}
