export interface SubscriptionTimelineEvent {
  index: number;
  event_type: 'purchase' | 'renewal' | 'activation';
  date: string;
  period_days: number | null;
  amount_kopeks: number | null;
  prev_end: string | null;
  new_end: string | null;
  downtime_seconds: number | null;
  carried_seconds: number | null;
}
export interface SubscriptionTimelineResponse {
  events: SubscriptionTimelineEvent[];
  since: string | null;
}
