import { describe, it, expect } from 'vitest';
import { humanizeDuration, formatCompact, formatDetailed } from './subscriptionTimeline';
import type { SubscriptionTimelineEvent } from '../types/timeline';

const t = (k: string, o?: Record<string, unknown>) => (o ? `${k}:${JSON.stringify(o)}` : k);

const events: SubscriptionTimelineEvent[] = [
  {
    index: 1,
    event_type: 'purchase',
    date: '2026-03-21T02:42:00+00:00',
    period_days: 30,
    amount_kopeks: 10000,
    prev_end: null,
    new_end: '2026-04-20T02:42:00+00:00',
    downtime_seconds: null,
    carried_seconds: null,
  },
  {
    index: 2,
    event_type: 'purchase',
    date: '2026-04-23T13:02:00+00:00',
    period_days: 30,
    amount_kopeks: 10000,
    prev_end: '2026-04-20T02:42:00+00:00',
    new_end: '2026-05-23T13:02:00+00:00',
    downtime_seconds: 296400,
    carried_seconds: null,
  },
];

describe('subscriptionTimeline', () => {
  it('humanizeDuration', () => {
    expect(humanizeDuration(296400, t)).toContain('3'); // ~3 дн
  });
  it('formatCompact one line per event', () => {
    const out = formatCompact(events, t);
    expect(out.split('\n').length).toBe(2);
  });
  it('formatDetailed shows downtime for event 2', () => {
    const out = formatDetailed(events, t);
    expect(out).toContain('1)');
    expect(out).toContain('2)');
    expect(out).toContain('timeline.downtime'); // ключ пояснения простоя
  });
});
