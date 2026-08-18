// @vitest-environment jsdom
/**
 * SimpleDevices — экран «Устройства» простого режима. Обязательные проверки
 * из брифа задачи 4: заглушки «Без названия» не бывает никогда (только
 * device_model, если алиас не задан); при безлимите (device_limit === 0)
 * нет полосы заполнения и лимит недоступен для редактирования; режим выбора
 * считает отмеченные устройства и включает кнопку отключения с их числом.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SimpleDevices from './SimpleDevices';
import { subscriptionApi } from '../../api/subscription';
import type { Subscription } from '../../types';

vi.mock('../../api/subscription', () => ({
  subscriptionApi: {
    getSubscription: vi.fn(),
    getDevices: vi.fn(),
    renameDevice: vi.fn(),
    deleteDevicesBatch: vi.fn(),
    deleteAllDevices: vi.fn(),
  },
}));

vi.mock('@/platform', () => ({
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn() }),
  usePlatform: () => ({ platform: 'web', haptic: { impact: vi.fn(), notification: vi.fn() } }),
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
  autopay_enabled: false,
  autopay_days_before: 3,
  subscription_url: 'https://example.com/sub',
  hide_subscription_link: false,
  is_active: true,
  is_expired: false,
  is_limited: false,
  tariff_name: 'Стандарт',
};

const getSubscriptionMock = subscriptionApi.getSubscription as ReturnType<typeof vi.fn>;
const getDevicesMock = subscriptionApi.getDevices as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
  await i18n.changeLanguage('ru');
  getSubscriptionMock.mockResolvedValue({
    has_subscription: true,
    subscription: ACTIVE_SUBSCRIPTION,
  });
});

afterEach(() => cleanup());

describe('SimpleDevices', () => {
  it('без алиаса показывает модель из панели, заглушки «Без названия» нет никогда', async () => {
    getDevicesMock.mockResolvedValue({
      devices: [
        {
          hwid: 'hw-1',
          platform: 'iOS',
          device_model: 'iPhone 12 Pro',
          created_at: new Date().toISOString(),
          local_name: null,
          client: 'Happ',
        },
      ],
      total: 1,
      device_limit: 5,
    });

    render(<SimpleDevices />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('iPhone 12 Pro')).toBeTruthy();
    });
    expect(screen.queryByText(/Без названия/i)).toBeNull();
  });

  it('безлимит (device_limit === 0): нет полосы заполнения, лимит недоступен', async () => {
    getDevicesMock.mockResolvedValue({
      devices: [],
      total: 0,
      device_limit: 0,
    });

    render(<SimpleDevices />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getAllByText('∞').length).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId('devices-occupancy-bar')).toBeNull();

    const limitRow = screen.getByRole('button', { name: /Лимит устройств/i });
    expect(limitRow.hasAttribute('disabled')).toBe(true);
    await userEvent.click(limitRow);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('режим выбора: отмеченные устройства считаются, кнопка называет число', async () => {
    getDevicesMock.mockResolvedValue({
      devices: [
        {
          hwid: 'hw-1',
          platform: 'iOS',
          device_model: 'iPhone 12 Pro',
          created_at: new Date().toISOString(),
          local_name: 'Мой айфон',
          client: 'Happ',
        },
        {
          hwid: 'hw-2',
          platform: 'Android',
          device_model: 'Redmi Note 12',
          created_at: new Date().toISOString(),
          local_name: null,
          client: 'INCY',
        },
      ],
      total: 2,
      device_limit: 5,
    });

    const user = userEvent.setup();
    render(<SimpleDevices />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Мой айфон')).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: /Выбрать/i }));
    await user.click(screen.getByRole('button', { name: 'Мой айфон' }));

    expect(screen.getByText(/Выбрано 1/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Отключить 1/i })).toBeTruthy();
  });
});
