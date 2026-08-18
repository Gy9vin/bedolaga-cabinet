// @vitest-environment jsdom
/**
 * SimpleProfile — экран «Профиль» простого режима. Критический инвариант
 * из брифа задачи 8: тумблер «Простой интерфейс» обязан рендериться ВСЕГДА,
 * даже если запрос настроек уведомлений упал — иначе человек запирается в
 * простом режиме без выхода (именно так это уже один раз ломалось в волне 1).
 * Плюс: вход в админ-панель остаётся доступен администратору в простом
 * режиме.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SimpleProfile from './SimpleProfile';
import { authApi } from '../../api/auth';
import { notificationsApi } from '../../api/notifications';
import { infoApi } from '../../api/info';

// useAuthStore — реальный zustand-стор с persist middleware, который в этом
// окружении падает на localStorage (см. предупреждение про
// --localstorage-file). Подменяем стор целиком лёгким моком с изменяемым
// состоянием, а не дёргаем настоящий persist через setState().
const authState: { user: unknown; isAdmin: boolean; isAuthenticated: boolean; logout: () => void } =
  {
    user: null,
    isAdmin: false,
    isAuthenticated: true,
    logout: vi.fn(),
  };
vi.mock('../../store/auth', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

vi.mock('../../api/auth', () => ({
  authApi: {
    getLinkedProviders: vi.fn(),
  },
}));

vi.mock('../../api/notifications', () => ({
  notificationsApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

vi.mock('../../api/info', () => ({
  infoApi: {
    getLanguages: vi.fn(),
    getUiMode: vi.fn(),
    updateUiMode: vi.fn(),
  },
}));

vi.mock('@/platform', () => ({
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn() }),
  usePlatform: () => ({
    platform: 'web',
    haptic: { impact: vi.fn(), notification: vi.fn() },
  }),
}));

vi.mock('@/platform/hooks/usePlatform', () => ({
  usePlatform: () => ({ openLink: vi.fn() }),
  useIsTelegram: () => false,
}));

vi.mock('../Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

const getLinkedProvidersMock = authApi.getLinkedProviders as ReturnType<typeof vi.fn>;
const getSettingsMock = notificationsApi.getSettings as ReturnType<typeof vi.fn>;
const getLanguagesMock = infoApi.getLanguages as ReturnType<typeof vi.fn>;
const getUiModeMock = infoApi.getUiMode as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
  await i18n.changeLanguage('ru');
  authState.user = {
    id: 1,
    telegram_id: 8241,
    username: 'mihail',
    first_name: 'Михаил',
    last_name: null,
    email: null,
  };
  authState.isAdmin = false;
  authState.isAuthenticated = true;
  getLinkedProvidersMock.mockResolvedValue({
    providers: [{ provider: 'telegram', linked: true, identifier: '@mihail' }],
  });
  getLanguagesMock.mockResolvedValue({
    languages: [{ code: 'ru', name: 'Русский', flag: '🇷🇺' }],
    default: 'ru',
  });
  getUiModeMock.mockResolvedValue({ mode: 'simple', choice: 'simple', global_default: 'advanced' });
});

afterEach(() => cleanup());

describe('SimpleProfile', () => {
  it('тумблер режима рендерится, даже когда запрос настроек уведомлений упал', async () => {
    getSettingsMock.mockRejectedValue(new Error('network error'));

    render(<SimpleProfile />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Простой интерфейс/i)).toBeTruthy();
    });
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThan(0);
  });

  it('вход в админ-панель доступен администратору в простом режиме', async () => {
    getSettingsMock.mockResolvedValue({
      subscription_expiry_enabled: true,
      subscription_expiry_days: 3,
      traffic_warning_enabled: false,
      traffic_warning_percent: 80,
      balance_low_enabled: false,
      balance_low_threshold: 0,
      news_enabled: false,
      promo_offers_enabled: false,
    });
    authState.isAdmin = true;

    render(<SimpleProfile />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Админ-панель/i)).toBeTruthy();
    });
  });

  it('обычному пользователю админ-панель не показывается', async () => {
    getSettingsMock.mockResolvedValue({
      subscription_expiry_enabled: true,
      subscription_expiry_days: 3,
      traffic_warning_enabled: false,
      traffic_warning_percent: 80,
      balance_low_enabled: false,
      balance_low_threshold: 0,
      news_enabled: false,
      promo_offers_enabled: false,
    });
    authState.isAdmin = false;

    render(<SimpleProfile />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Простой интерфейс/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Админ-панель/i)).toBeNull();
  });
});
