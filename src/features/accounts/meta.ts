import type { components } from '../../api';
import type { SelectOption } from '../../ui';

export type AccountType = components['schemas']['AccountType'];
export type Provider = components['schemas']['Provider'];

/** Providers appear as text initials on a neutral tile; no third-party logos (Design System §5). */
export const PROVIDERS: Record<Provider, { name: string; initials: string; types: AccountType[] }> = {
  mtn_momo: { name: 'MTN MoMo', initials: 'MTN', types: ['mobile_money'] },
  airtel_money: { name: 'Airtel Money', initials: 'AT', types: ['mobile_money'] },
  bk: { name: 'Bank of Kigali', initials: 'BK', types: ['bank', 'card'] },
  equity: { name: 'Equity Bank', initials: 'EQ', types: ['bank', 'card'] },
  im_bank: { name: 'I&M Bank', initials: 'IM', types: ['bank', 'card'] },
  cash: { name: 'Cash', initials: '', types: ['cash'] },
  other: { name: 'Other', initials: '', types: ['mobile_money', 'bank', 'card'] },
};

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'mobile_money', label: 'Mobile money', icon: 'smartphone' },
  { value: 'bank', label: 'Bank', icon: 'account_balance' },
  { value: 'card', label: 'Card', icon: 'credit_card' },
  { value: 'cash', label: 'Cash', icon: 'payments' },
];

export const typeIcon = (type?: AccountType) => ACCOUNT_TYPES.find((t) => t.value === type)?.icon ?? 'wallet';
export const typeLabel = (type?: AccountType) => ACCOUNT_TYPES.find((t) => t.value === type)?.label ?? 'Account';

export const providerOptions = (type: AccountType): SelectOption<Provider>[] =>
  (Object.keys(PROVIDERS) as Provider[])
    .filter((p) => PROVIDERS[p].types.includes(type))
    .map((p) => ({ value: p, label: PROVIDERS[p].name }));

export const CURRENCIES: SelectOption<string>[] = [
  { value: 'RWF', label: 'RWF', detail: 'Rwandan franc' },
  { value: 'USD', label: 'USD', detail: 'US dollar' },
  { value: 'EUR', label: 'EUR', detail: 'Euro' },
  { value: 'KES', label: 'KES', detail: 'Kenyan shilling' },
  { value: 'UGX', label: 'UGX', detail: 'Ugandan shilling' },
  { value: 'TZS', label: 'TZS', detail: 'Tanzanian shilling' },
  { value: 'GBP', label: 'GBP', detail: 'British pound' },
];

/** Tile for an account row: initials for known providers, otherwise the type icon. */
export function accountTile(a: { provider?: Provider | null; type?: AccountType }) {
  const initials = a.provider ? PROVIDERS[a.provider]?.initials : '';
  return initials ? { initials } : { icon: typeIcon(a.type) };
}

/** "078 •••• 214" style subtitle. */
export function accountSubtitle(a: { number_last?: string; type?: AccountType }) {
  if (a.number_last) return `•••• ${a.number_last}`;
  return a.type === 'cash' ? 'Counted manually' : typeLabel(a.type);
}
