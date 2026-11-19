import type { TransactionItem } from '../../db/repositories';
import { dayKey } from '../../lib/ledger';
import { Amount, Badge, ListRow, SourceTag, type SourceKind, type TileTone } from '../../ui';

/** "Kigali Grocers", or the category / direction when there's no payee. */
export function itemTitle(i: TransactionItem) {
  if (i.transfer) return `${i.transfer.from?.name ?? 'Account'} → ${i.transfer.to?.name ?? 'Account'}`;
  return i.txn.counterparty_text || i.category?.name || (i.txn.kind === 'in' ? 'Money in' : 'Money out');
}

/** "Food & Groceries · MTN MoMo", or "Transfer between your accounts". */
export function itemSubtitle(i: TransactionItem) {
  if (i.transfer) return 'Transfer between your accounts';
  return [i.category?.name ?? 'No category', i.account?.name].filter(Boolean).join(' · ');
}

export function itemTile(i: TransactionItem): { icon: string; tone: TileTone } {
  if (i.transfer) return { icon: 'swap_horiz', tone: 'xfer' };
  return {
    icon: i.category?.icon ?? (i.txn.kind === 'in' ? 'south_west' : 'north_east'),
    tone: i.txn.kind === 'in' ? 'in' : 'neutral',
  };
}

export const itemAmountKind = (i: TransactionItem) => (i.transfer ? 'xfer' : i.txn.kind);

/** Screen 02 row: tile, payee, category · account, amount with its source tag, and any status badge. */
export function TransactionRow({
  item,
  divider,
  onPress,
}: {
  item: TransactionItem;
  divider?: boolean;
  onPress?: () => void;
}) {
  const t = item.txn;
  return (
    <ListRow
      divider={divider}
      title={itemTitle(item)}
      subtitle={itemSubtitle(item)}
      tile={itemTile(item)}
      onPress={onPress}
      note={
        t.status === 'pending_review' || t.has_parts ? (
          <>
            {t.status === 'pending_review' ? <Badge label="Needs review" tone="warn" icon="pending" /> : null}
            {t.has_parts ? <Badge label="Split" icon="call_split" /> : null}
          </>
        ) : undefined
      }
      end={
        <>
          <Amount value={t.amount} currency={t.currency} kind={itemAmountKind(item)} />
          <SourceTag source={(t.source ?? 'manual') as SourceKind} />
        </>
      }
    />
  );
}

/** "Today · Tue 17 Nov", "Yesterday · Mon 16 Nov", "Sun 15 Nov", with the year when it isn't this year. */
export function dayLabel(day: string, now = new Date()) {
  const date = new Date(`${day}T12:00:00Z`);
  const thisYear = day.slice(0, 4) === dayKey(now.toISOString()).slice(0, 4);
  const text = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(thisYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  });
  const todayKey = dayKey(now.toISOString());
  const yesterdayKey = dayKey(new Date(now.getTime() - 86_400_000).toISOString());
  if (day === todayKey) return `Today · ${text}`;
  if (day === yesterdayKey) return `Yesterday · ${text}`;
  return text;
}
