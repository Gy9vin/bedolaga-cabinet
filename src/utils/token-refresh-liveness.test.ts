// @vitest-environment jsdom
/**
 * Regression tests for two session-liveness gaps found while chasing "the
 * cabinet logs the user out after a couple minutes of inactivity":
 *
 * 1. tokenRefreshManager had a subscribe()/notifySubscribers() mechanism that
 *    nothing ever subscribed to. doRefresh() only persisted the new access
 *    token to tokenStorage (localStorage) — the Zustand auth store's
 *    `accessToken` field, once set at login/initialize(), was never updated
 *    again. Anything reading state.accessToken directly (WebSocketProvider)
 *    kept using the token issued at boot forever, so it silently reconnected
 *    with an already-expired token after the 15-minute TTL passed.
 *
 * 2. Refresh was purely reactive (next request sees an expired token / next
 *    401 triggers a retry). If the tab was backgrounded past the token TTL
 *    and came back to a screen that renders from cache without firing a
 *    request, nothing refreshed until something else happened to.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@telegram-apps/sdk-react', () => ({
  getCloudStorageItem: vi.fn(async () => ''),
  setCloudStorageItem: vi.fn(async () => {}),
  deleteCloudStorageItem: vi.fn(async () => {}),
}));
vi.mock('../hooks/useTelegramSDK', () => ({ isInTelegramWebApp: () => false }));
vi.mock('../api/health', () => ({ reportPossibleBackendDown: vi.fn() }));

import axios from 'axios';
import { tokenStorage, tokenRefreshManager } from './token';

// jsdom's localStorage in this repo's Vitest setup isn't reliable as a plain
// synchronous store (see the `--localstorage-file` warning at Vitest startup),
// and tokenStorage swallows storage errors — so stub it with a plain in-memory
// Map, same as token.test.ts does for its cross-tab tests.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.has(k) ? (this.store.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
}
vi.stubGlobal('localStorage', new MemoryStorage());
vi.stubGlobal('sessionStorage', new MemoryStorage());

function makeJwt(expSecondsFromNow: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = { sub: '1', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow };
  const b64 = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=+$/, '');
  return `${b64(header)}.${b64(payload)}.sig`;
}

// A dangling vi.spyOn(axios, 'post') from one test carries its call history
// into the next spyOn(axios, 'post') call in a later test (same method, same
// object) unless explicitly restored — which previously made the "focus
// regain" tests below pass even with the feature deleted, because they were
// silently asserting on test #1's leftover call. Restore after every test.
afterEach(() => {
  vi.restoreAllMocks();
});

describe('tokenRefreshManager notifies subscribers with the refreshed token', () => {
  beforeEach(() => {
    tokenStorage.clearTokens();
  });

  it('calls subscribers with the new access token after a successful refresh', async () => {
    tokenStorage.setTokens(makeJwt(-60), 'refresh-xyz');
    vi.spyOn(axios, 'post').mockResolvedValueOnce({ data: { access_token: makeJwt(900) } });

    const received: (string | null)[] = [];
    tokenRefreshManager.subscribe((token) => received.push(token));

    const result = await tokenRefreshManager.refreshAccessToken();

    expect(result).not.toBeNull();
    expect(received).toEqual([result]);
  });
});

describe('proactive refresh on tab focus/visibility regain', () => {
  const originalVisibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  }

  afterEach(() => {
    if (originalVisibility) Object.defineProperty(document, 'visibilityState', originalVisibility);
  });

  it('refreshes when the tab becomes visible with an expired access token', async () => {
    tokenStorage.clearTokens();
    tokenStorage.setTokens(makeJwt(-60), 'refresh-xyz');
    const postSpy = vi
      .spyOn(axios, 'post')
      .mockResolvedValueOnce({ data: { access_token: makeJwt(900) } });

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    // refreshAccessToken() is fire-and-forget from the listener; flush microtasks.
    await new Promise((r) => setTimeout(r, 0));

    expect(postSpy).toHaveBeenCalled();
  });

  it('does not refresh when regaining focus with a still-valid access token', async () => {
    tokenStorage.clearTokens();
    tokenStorage.setTokens(makeJwt(900), 'refresh-xyz');
    const postSpy = vi.spyOn(axios, 'post');

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((r) => setTimeout(r, 0));

    expect(postSpy).not.toHaveBeenCalled();
  });
});
