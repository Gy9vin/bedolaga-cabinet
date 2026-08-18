// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { readUiModeCache, writeUiModeCache, UI_MODE_CACHE_KEY } from './useUiMode';

// jsdom's localStorage in this repo's Vitest setup isn't reliable as a plain
// synchronous store (see the `--localstorage-file` warning at Vitest startup) —
// stub it with a plain in-memory Map, same as token.test.ts /
// token-refresh-liveness.test.ts do.
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

describe('кэш режима интерфейса', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('без записи отдаёт advanced — полный кабинет как безопасный дефолт', () => {
    expect(readUiModeCache()).toBe('advanced');
  });

  it('переживает перезагрузку страницы', () => {
    writeUiModeCache('simple');
    expect(readUiModeCache()).toBe('simple');
  });

  it('игнорирует испорченное значение вместо того, чтобы верить ему', () => {
    localStorage.setItem(UI_MODE_CACHE_KEY, 'lite');
    expect(readUiModeCache()).toBe('advanced');
  });
});
