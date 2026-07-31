/**
 * Pure logic for deciding whether to show the ChannelNudge popup.
 *
 * Rules:
 * 1. show_post=true → always show (server-side seen throttle via markChannelPostSeen).
 * 2. needs_subscribe=true, no new post → show at most once per 24 hours
 *    (client-side localStorage throttle, key: channelSubscribeNudgeDismissedAt).
 * 3. Otherwise → hide.
 */

export const SUBSCRIBE_NUDGE_LS_KEY = 'channelSubscribeNudgeDismissedAt';
export const SUBSCRIBE_NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 h

export interface NudgeVisibilityInput {
  show_post: boolean;
  needs_subscribe: boolean;
  latest_post: { id: number } | null;
  /** timestamp (ms) when subscribe-only nudge was last dismissed; null = never */
  lastDismissedAt: number | null;
  /** current time in ms (injectable for tests) */
  nowMs?: number;
}

/**
 * Returns true when the ChannelNudge popup should be rendered.
 */
export function shouldShowChannelNudge(input: NudgeVisibilityInput): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {
    show_post,
    needs_subscribe,
    latest_post: _latest_post,
    lastDismissedAt,
    nowMs = Date.now(),
  } = input;

  // Case 1: there is a fresh post to show — always show once per post (server throttles).
  if (show_post) return true;

  // Case 2: user is not subscribed — throttle to once per 24h regardless of latest_post.
  if (needs_subscribe) {
    if (lastDismissedAt == null) return true;
    return nowMs - lastDismissedAt >= SUBSCRIBE_NUDGE_COOLDOWN_MS;
  }

  return false;
}

/**
 * Read the stored dismiss timestamp from localStorage.
 * Returns null when unavailable (SSR / private browsing).
 */
export function readSubscribeDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(SUBSCRIBE_NUDGE_LS_KEY);
    if (raw == null) return null;
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

/**
 * Persist the current timestamp as the subscribe-only dismiss moment.
 */
export function writeSubscribeDismissedAt(nowMs = Date.now()): void {
  try {
    localStorage.setItem(SUBSCRIBE_NUDGE_LS_KEY, String(nowMs));
  } catch {
    // localStorage may be unavailable (e.g. Safari private mode); silently ignore.
  }
}
