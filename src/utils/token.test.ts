import { beforeEach, describe, expect, it, vi } from 'vitest';

// token.ts pulls in the Telegram SDK + health reporter at module load. None of
// them are exercised by the pure storage paths we test here (isInTelegramWebApp
// is forced false so the CloudStorage mirror is a no-op), so stub them out.
vi.mock('@telegram-apps/sdk-react', () => ({
  getCloudStorageItem: vi.fn(async () => ''),
  setCloudStorageItem: vi.fn(async () => {}),
  deleteCloudStorageItem: vi.fn(async () => {}),
}));
vi.mock('../hooks/useTelegramSDK', () => ({ isInTelegramWebApp: () => false }));
vi.mock('../api/health', () => ({ reportPossibleBackendDown: vi.fn() }));

// Minimal in-memory Web Storage for the node test env (no jsdom).
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

// localStorage is shared across a browser origin (all tabs); sessionStorage is
// per-tab. We model "open a new tab" as: keep localStorage, get a fresh
// (empty) sessionStorage.
let sharedLocal: MemoryStorage;
let tabSession: MemoryStorage;

function installStorages(): void {
  vi.stubGlobal('localStorage', sharedLocal);
  vi.stubGlobal('sessionStorage', tabSession);
}

import { tokenStorage } from './token';

beforeEach(() => {
  sharedLocal = new MemoryStorage();
  tabSession = new MemoryStorage();
  installStorages();
});

describe('tokenStorage cross-tab session sharing', () => {
  it('a new tab (fresh sessionStorage, shared localStorage) still sees the access token', () => {
    tokenStorage.setTokens('access-abc', 'refresh-xyz');

    // Simulate opening a NEW TAB: same origin localStorage, brand-new sessionStorage.
    tabSession = new MemoryStorage();
    installStorages();

    expect(tokenStorage.getRefreshToken()).toBe('refresh-xyz');
    // Regression: this was null when the access token lived only in the
    // per-tab sessionStorage, forcing every new tab back to the login screen.
    expect(tokenStorage.getAccessToken()).toBe('access-abc');
  });

  it('migrateFromLocalStorage keeps the access token readable in a later tab', () => {
    tokenStorage.setTokens('access-abc', 'refresh-xyz');
    // New tab bootstrap runs migrateFromLocalStorage() during initialize().
    tabSession = new MemoryStorage();
    installStorages();
    tokenStorage.migrateFromLocalStorage();

    expect(tokenStorage.getAccessToken()).toBe('access-abc');
  });

  it('clearTokens wipes the access token from shared storage', () => {
    tokenStorage.setTokens('access-abc', 'refresh-xyz');
    tokenStorage.clearTokens();
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });
});
