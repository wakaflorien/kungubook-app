/** "Today, 11:42", "Yesterday, 08:15" or "Mon 16 Nov, 08:15". */
export function dateTimeText(d: Date, now = new Date()) {
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, now)) return `Today, ${time}`;
  if (same(d, new Date(now.getTime() - 86_400_000))) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}
