import { describe, it, expect } from 'vitest';
import type { MergeAccountPreview, MergePreviewResponse } from '../types';

describe('MergeAccountPreview types', () => {
  it('accepts referrals_count and recommended fields', () => {
    const preview: MergeAccountPreview = {
      id: 1,
      username: null,
      first_name: null,
      email: null,
      auth_methods: ['telegram'],
      balance_kopeks: 0,
      subscription: null,
      created_at: null,
      referrals_count: 5,
      recommended: true,
    };
    expect(preview.referrals_count).toBe(5);
    expect(preview.recommended).toBe(true);
  });

  it('MergePreviewResponse uses updated MergeAccountPreview', () => {
    const response: MergePreviewResponse = {
      primary: {
        id: 1,
        username: null,
        first_name: null,
        email: null,
        auth_methods: [],
        balance_kopeks: 0,
        subscription: null,
        created_at: null,
        referrals_count: 0,
        recommended: true,
      },
      secondary: {
        id: 2,
        username: null,
        first_name: null,
        email: null,
        auth_methods: [],
        balance_kopeks: 0,
        subscription: null,
        created_at: null,
        referrals_count: 3,
        recommended: false,
      },
      expires_in_seconds: 1800,
    };
    expect(response.primary.recommended).toBe(true);
    expect(response.secondary.referrals_count).toBe(3);
  });
});
