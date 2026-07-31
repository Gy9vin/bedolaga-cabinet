import { describe, expect, it } from 'vitest';
import { shouldShowChannelNudge, SUBSCRIBE_NUDGE_COOLDOWN_MS } from './channelNudgeVisibility';

const NOW = 1_700_000_000_000;

describe('shouldShowChannelNudge', () => {
  // ── new-post path ────────────────────────────────────────────────────────────

  it('shows when show_post=true, regardless of subscription status', () => {
    expect(
      shouldShowChannelNudge({
        show_post: true,
        needs_subscribe: false,
        latest_post: { id: 42 },
        lastDismissedAt: null,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  it('shows when show_post=true even if subscribe-nudge was recently dismissed', () => {
    expect(
      shouldShowChannelNudge({
        show_post: true,
        needs_subscribe: true,
        latest_post: { id: 99 },
        lastDismissedAt: NOW - 1000, // dismissed 1 s ago
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  // ── subscribe-only path (24-h throttle) ─────────────────────────────────────

  it('shows when needs_subscribe=true and never dismissed before', () => {
    expect(
      shouldShowChannelNudge({
        show_post: false,
        needs_subscribe: true,
        latest_post: null,
        lastDismissedAt: null,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  it('hides subscribe nudge when dismissed less than 24 h ago', () => {
    expect(
      shouldShowChannelNudge({
        show_post: false,
        needs_subscribe: true,
        latest_post: null,
        lastDismissedAt: NOW - SUBSCRIBE_NUDGE_COOLDOWN_MS + 1,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it('shows subscribe nudge again after 24 h have elapsed', () => {
    expect(
      shouldShowChannelNudge({
        show_post: false,
        needs_subscribe: true,
        latest_post: null,
        lastDismissedAt: NOW - SUBSCRIBE_NUDGE_COOLDOWN_MS,
        nowMs: NOW,
      }),
    ).toBe(true);
  });

  // ── nothing to show ──────────────────────────────────────────────────────────

  it('hides when show_post=false and needs_subscribe=false', () => {
    expect(
      shouldShowChannelNudge({
        show_post: false,
        needs_subscribe: false,
        latest_post: null,
        lastDismissedAt: null,
        nowMs: NOW,
      }),
    ).toBe(false);
  });

  it('hides when show_post=false and needs_subscribe=false even with a post present', () => {
    // Backend sets show_post=false when the user already saw the post;
    // needs_subscribe=false means they ARE subscribed — nothing to nudge.
    expect(
      shouldShowChannelNudge({
        show_post: false,
        needs_subscribe: false,
        latest_post: { id: 7 },
        lastDismissedAt: null,
        nowMs: NOW,
      }),
    ).toBe(false);
  });
});
