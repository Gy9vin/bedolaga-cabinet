import { describe, it, expect } from 'vitest';
import type {
  AdminMergePreviewResponse,
  AdminMergeUserPreview,
  AdminMergeSubPreview,
  AdminMergeDeviceInfo,
} from '../types';

function buildMergePayload(
  primaryId: number,
  secondaryId: number,
  keepSubscriptionId: number | null,
): { primary_user_id: number; secondary_user_id: number; keep_subscription_id: number | null } {
  return {
    primary_user_id: primaryId,
    secondary_user_id: secondaryId,
    keep_subscription_id: keepSubscriptionId,
  };
}

function chooseKeptSub(
  preview: AdminMergePreviewResponse,
  subId: number | null,
): AdminMergeSubPreview | null {
  if (subId === null) return null;
  const allSubs = [...preview.primary.subscriptions, ...preview.secondary.subscriptions];
  return allSubs.find((s) => s.subscription_id === subId) ?? null;
}

describe('buildMergePayload', () => {
  it('includes keep_subscription_id when provided', () => {
    const p = buildMergePayload(1, 2, 42);
    expect(p).toEqual({ primary_user_id: 1, secondary_user_id: 2, keep_subscription_id: 42 });
  });

  it('passes null when no sub selected', () => {
    const p = buildMergePayload(1, 2, null);
    expect(p.keep_subscription_id).toBeNull();
  });
});

describe('chooseKeptSub', () => {
  const sub1: AdminMergeSubPreview = {
    subscription_id: 10,
    tariff_name: 'Basic',
    end_date: '2026-12-01T00:00:00Z',
    status: 'active',
    subscription_url: 'https://link/a',
    subscription_crypto_link: null,
    remnawave_short_uuid: 'short-a',
    devices_count: 2,
    devices: [],
  };
  const sub2: AdminMergeSubPreview = {
    subscription_id: 20,
    tariff_name: 'Pro',
    end_date: '2027-01-01T00:00:00Z',
    status: 'active',
    subscription_url: 'https://link/b',
    subscription_crypto_link: null,
    remnawave_short_uuid: 'short-b',
    devices_count: 0,
    devices: [],
  };
  const user1: AdminMergeUserPreview = {
    id: 1,
    username: null,
    first_name: null,
    email: null,
    telegram_id: 111,
    auth_methods: ['telegram'],
    balance_kopeks: 0,
    referrals_count: 0,
    created_at: null,
    subscriptions: [sub1],
  };
  const user2: AdminMergeUserPreview = {
    id: 2,
    username: null,
    first_name: null,
    email: null,
    telegram_id: 222,
    auth_methods: ['telegram'],
    balance_kopeks: 0,
    referrals_count: 0,
    created_at: null,
    subscriptions: [sub2],
  };
  const preview: AdminMergePreviewResponse = { primary: user1, secondary: user2 };

  it('finds sub in primary', () => {
    expect(chooseKeptSub(preview, 10)?.subscription_id).toBe(10);
  });

  it('finds sub in secondary', () => {
    expect(chooseKeptSub(preview, 20)?.subscription_id).toBe(20);
  });

  it('returns null when subId is null', () => {
    expect(chooseKeptSub(preview, null)).toBeNull();
  });

  it('returns null for unknown id', () => {
    expect(chooseKeptSub(preview, 999)).toBeNull();
  });
});

describe('AdminMergeDeviceInfo type', () => {
  it('accepts all optional fields', () => {
    const d: AdminMergeDeviceInfo = {
      hwid: 'abc',
      app: 'SingBox',
      platform: 'iOS',
      last_seen: '2026-07-20T10:00:00Z',
    };
    expect(d.app).toBe('SingBox');
  });
});
