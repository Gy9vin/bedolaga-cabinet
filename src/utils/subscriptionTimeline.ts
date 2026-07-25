import type { SubscriptionTimelineEvent } from '../types/timeline';

type T = (key: string, opts?: Record<string, unknown>) => string;

const fmt = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function humanizeDuration(seconds: number, t: T): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const parts: string[] = [];
  if (d) parts.push(t('timeline.unitDays', { count: d }));
  if (h) parts.push(t('timeline.unitHours', { count: h }));
  return parts.join(' ') || t('timeline.unitHours', { count: 0 });
}

export function formatCompact(events: SubscriptionTimelineEvent[], t: T): string {
  return events
    .map(
      (e) =>
        `${e.index}) ${fmt(e.date)} — ${t('timeline.tariffDays', { count: e.period_days ?? 0 })} → ${t('timeline.until')} ${fmt(e.new_end)}`,
    )
    .join('\n');
}

export function formatDetailed(events: SubscriptionTimelineEvent[], t: T): string {
  const lines: string[] = [];
  for (const e of events) {
    lines.push(
      `${e.index}) ${fmt(e.date)} — ${t('timeline.tariffDays', { count: e.period_days ?? 0 })}`,
    );
    if (e.downtime_seconds) {
      lines.push(
        `   ${t('timeline.downtime', { prevEnd: fmt(e.prev_end), dur: humanizeDuration(e.downtime_seconds, t) })}`,
      );
    } else if (e.carried_seconds) {
      lines.push(`   ${t('timeline.carried', { dur: humanizeDuration(e.carried_seconds, t) })}`);
    }
    lines.push(`   → ${t('timeline.end')}: ${fmt(e.new_end)}`);
  }
  return lines.join('\n');
}
