import { describe, it, expect } from 'vitest';

/**
 * Tests the pure payload-building logic extracted from MergeAccounts:
 * selectedUserId -> keep_account value.
 */

function buildMergePayload(selectedUserId: number | null): { keep_account: number } | null {
  if (selectedUserId === null) return null;
  return { keep_account: selectedUserId };
}

function computeCombinedEndDate(
  primaryEnd: string | null | undefined,
  secondaryEnd: string | null | undefined,
  now: Date,
): Date | null {
  // Returns the combined end date when both subs are active.
  // Logic mirrors backend: winner keeps their end_date + loser's remaining days.
  // For display only — backend computes the authoritative value.
  if (!primaryEnd || !secondaryEnd) return null;
  const pDate = new Date(primaryEnd);
  const sDate = new Date(secondaryEnd);
  const winner = pDate > sDate ? pDate : sDate;
  const loser = pDate > sDate ? sDate : pDate;
  const remaining = Math.max(0, loser.getTime() - now.getTime());
  return new Date(winner.getTime() + remaining);
}

describe('buildMergePayload', () => {
  it('returns keep_account with the selected user id', () => {
    expect(buildMergePayload(42)).toEqual({ keep_account: 42 });
  });

  it('returns null when nothing selected', () => {
    expect(buildMergePayload(null)).toBeNull();
  });
});

describe('computeCombinedEndDate', () => {
  const now = new Date('2026-07-25T12:00:00Z');

  it('returns null when primary has no sub', () => {
    expect(computeCombinedEndDate(null, '2026-09-01T00:00:00Z', now)).toBeNull();
  });

  it('adds loser remaining days to winner', () => {
    // winner ends Sep 1, loser ends Aug 10 (15.5 days remaining from Jul 25 noon)
    const result = computeCombinedEndDate('2026-09-01T00:00:00Z', '2026-08-10T00:00:00Z', now);
    expect(result).not.toBeNull();
    // winner (Sep 1) + 15.5 days remaining = Sep 16 12:00Z
    expect(result!.toISOString().startsWith('2026-09-16')).toBe(true);
  });

  it('no extension when loser already expired', () => {
    const result = computeCombinedEndDate(
      '2026-09-01T00:00:00Z',
      '2026-07-01T00:00:00Z', // expired before now
      now,
    );
    // Combined = winner + 0 = Sep 1
    expect(result!.toISOString().startsWith('2026-09-01')).toBe(true);
  });
});
