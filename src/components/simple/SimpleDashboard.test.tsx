// @vitest-environment jsdom
/**
 * SimpleDashboard — главная простого режима. Пять обязательных состояний
 * из брифа задачи 2: активная подписка, нет подписки + бесплатный триал,
 * нет подписки + платный триал (цена ПРЯМО в кнопке), нет подписки без
 * триала (кнопки триала вообще нет), и безлимит устройств (device_limit=0
 * → «∞» без полосы заполнения).
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SimpleDashboard from './SimpleDashboard';
import { subscriptionApi } from '../../api/subscription';
import { balanceApi } from '../../api/balance';
import type { Subscription, TrialInfo } from '../../types';

vi.mock('../../api/subscription', () => ({
  subscriptionApi: {
    getSubscription: vi.fn(),
    getTrialInfo: vi.fn(),
    getDevices: vi.fn(),
    getConnectionLink: vi.fn(),
    activateTrial: vi.fn(),
    saveTrialCart: vi.fn(),
  },
}));

vi.mock('../../api/balance', () => ({
  balanceApi: {
    getBalance: vi.fn(),
  },
}));

vi.mock('@/platform', () => ({
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn() }),
  usePlatform: () => ({
    platform: 'web',
    haptic: { impact: vi.fn(), notification: vi.fn() },
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
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

const ACTIVE_SUBSCRIPTION: Subscription = {
  id: 1,
  status: 'active',
  is_trial: false,
  start_date: new Date(Date.now() - 6 * 86400_000).toISOString(),
  end_date: new Date(Date.now() + 24 * 86400_000).toISOString(),
  days_left: 24,
  hours_left: 0,
  minutes_left: 0,
  time_left_display: '24 дн.',
  traffic_limit_gb: 200,
  traffic_used_gb: 84,
  traffic_used_percent: 42,
  device_limit: 5,
  connected_squads: [],
  servers: [],
  autopay_enabled: true,
  autopay_days_before: 3,
  subscription_url: 'https://example.com/sub',
  hide_subscription_link: false,
  is_active: true,
  is_expired: false,
  is_limited: false,
};

const CONNECTION_LINK = {
  subscription_url: 'https://example.com/sub',
  display_link: null,
  happ_redirect_link: null,
  happ_scheme_link: null,
  connect_mode: 'default',
  hide_link: false,
  instructions: { steps: [] },
};

const FREE_TRIAL: TrialInfo = {
  is_available: true,
  duration_days: 3,
  traffic_limit_gb: 10,
  device_limit: 2,
  requires_payment: false,
  price_kopeks: 0,
  price_rubles: 0,
  reason_unavailable: null,
};

const PAID_TRIAL: TrialInfo = {
  ...FREE_TRIAL,
  requires_payment: true,
  price_kopeks: 1000,
  price_rubles: 10,
};

const UNAVAILABLE_TRIAL: TrialInfo = {
  ...FREE_TRIAL,
  is_available: false,
  reason_unavailable: 'already_used',
};

const getSubscriptionMock = subscriptionApi.getSubscription as ReturnType<typeof vi.fn>;
const getTrialInfoMock = subscriptionApi.getTrialInfo as ReturnType<typeof vi.fn>;
const getDevicesMock = subscriptionApi.getDevices as ReturnType<typeof vi.fn>;
const getConnectionLinkMock = subscriptionApi.getConnectionLink as ReturnType<typeof vi.fn>;
const getBalanceMock = balanceApi.getBalance as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
  // Тестовое окружение не пиннит язык — фиксируем ru, чтобы не гадать
  // между русским и английским текстом кнопок (как это уже делает
  // PriceBreakdown.test.tsx через альтернацию /Итого|Total/).
  await i18n.changeLanguage('ru');
  getConnectionLinkMock.mockResolvedValue(CONNECTION_LINK);
  getBalanceMock.mockResolvedValue({ balance_kopeks: 34000, balance_rubles: 340 });
  getDevicesMock.mockResolvedValue({ devices: [], total: 5, device_limit: 5 });
});

afterEach(() => cleanup());

describe('SimpleDashboard', () => {
  it('активная подписка: видно «Подключить устройство» и число оставшихся дней', async () => {
    getSubscriptionMock.mockResolvedValue({
      has_subscription: true,
      subscription: ACTIVE_SUBSCRIPTION,
    });

    render(<SimpleDashboard />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Подключить устройство/i)).toBeTruthy();
    });
    expect(screen.getByText(/24/)).toBeTruthy();
  });

  it('нет подписки + бесплатный триал: кнопка без цены', async () => {
    getSubscriptionMock.mockResolvedValue({ has_subscription: false, subscription: null });
    getTrialInfoMock.mockResolvedValue(FREE_TRIAL);

    render(<SimpleDashboard />, { wrapper: makeWrapper() });

    const btn = await screen.findByRole('button', { name: /Попробовать/i });
    expect(btn.textContent).not.toMatch(/₽/);
  });

  it('нет подписки + платный триал: цена стоит в самой кнопке', async () => {
    getSubscriptionMock.mockResolvedValue({ has_subscription: false, subscription: null });
    getTrialInfoMock.mockResolvedValue(PAID_TRIAL);

    render(<SimpleDashboard />, { wrapper: makeWrapper() });

    const btn = await screen.findByRole('button', { name: /Попробовать/i });
    expect(btn.textContent).toMatch(/₽/);
  });

  it('нет подписки, триал недоступен: кнопки триала нет, «Выбрать тариф» есть', async () => {
    getSubscriptionMock.mockResolvedValue({ has_subscription: false, subscription: null });
    getTrialInfoMock.mockResolvedValue(UNAVAILABLE_TRIAL);

    render(<SimpleDashboard />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Выбрать тариф/i)).toBeTruthy();
    });
    expect(screen.queryByText(/Попробовать/i)).toBeNull();
  });

  it('device_limit === 0: в плитке устройств «∞» и нет полосы заполнения', async () => {
    getSubscriptionMock.mockResolvedValue({
      has_subscription: true,
      subscription: { ...ACTIVE_SUBSCRIPTION, device_limit: 0 },
    });
    getDevicesMock.mockResolvedValue({ devices: [], total: 3, device_limit: 0 });

    render(<SimpleDashboard />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('∞')).toBeTruthy();
    });
    expect(screen.queryByTestId('devices-bar')).toBeNull();
  });
});
