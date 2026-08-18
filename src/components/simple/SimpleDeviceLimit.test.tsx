// @vitest-environment jsdom
/**
 * SimpleDeviceLimit — экран «Лимит устройств» простого режима. Обязательная
 * проверка из брифа задачи 4: количество отключаемых устройств и количество
 * освобождаемых мест — РАЗНЫЕ величины. Лимит 5, подключено 2, новый лимит
 * 3 → освобождается 2 места («старый лимит − новый»), а отключать нечего
 * («подключено − новый лимит» = 0) — выбор устройств скрыт. Плюс: безлимит
 * делает экран недоступным, на пробной подписке лимит менять нельзя.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SimpleDeviceLimit from './SimpleDeviceLimit';
import { subscriptionApi } from '../../api/subscription';
import type { Subscription } from '../../types';

vi.mock('../../api/subscription', () => ({
  subscriptionApi: {
    getSubscription: vi.fn(),
    getDevices: vi.fn(),
    getDeviceReductionInfo: vi.fn(),
    getDevicePrice: vi.fn(),
    reduceDevices: vi.fn(),
    purchaseDevices: vi.fn(),
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

function makeSubscription(overrides: Partial<Subscription>): Subscription {
  return {
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
    ...overrides,
  };
}

const getSubscriptionMock = subscriptionApi.getSubscription as ReturnType<typeof vi.fn>;
const getDevicesMock = subscriptionApi.getDevices as ReturnType<typeof vi.fn>;
const getDeviceReductionInfoMock = subscriptionApi.getDeviceReductionInfo as ReturnType<
  typeof vi.fn
>;
const getDevicePriceMock = subscriptionApi.getDevicePrice as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
  await i18n.changeLanguage('ru');
  getDevicePriceMock.mockResolvedValue({ available: true, max_device_limit: 20 });
});

afterEach(() => cleanup());

describe('SimpleDeviceLimit', () => {
  it('лимит 5, подключено 2, новый лимит 3: освобождается 2 места, отключать нечего, выбор скрыт', async () => {
    getSubscriptionMock.mockResolvedValue({
      has_subscription: true,
      subscription: makeSubscription({ device_limit: 5 }),
    });
    getDevicesMock.mockResolvedValue({
      devices: [
        {
          hwid: 'hw-1',
          platform: 'iOS',
          device_model: 'iPhone',
          created_at: null,
          local_name: null,
        },
        {
          hwid: 'hw-2',
          platform: 'Android',
          device_model: 'Redmi',
          created_at: null,
          local_name: null,
        },
      ],
      total: 2,
      device_limit: 5,
    });
    getDeviceReductionInfoMock.mockResolvedValue({
      available: true,
      current_device_limit: 5,
      min_device_limit: 3,
      can_reduce: 2,
      connected_devices_count: 2,
      refund_kopeks_per_slot: 4800,
    });

    const user = userEvent.setup();
    render(<SimpleDeviceLimit />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Убавить|−/i })).toBeTruthy();
    });

    const decreaseBtn = screen.getByRole('button', { name: /Убавить|−/i });
    await user.click(decreaseBtn);
    await user.click(decreaseBtn);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeTruthy();
    });

    // Освобождается 2 места (5 - 3), а выбор устройств для отключения скрыт,
    // потому что подключённых устройств (2) не больше нового лимита (3).
    expect(screen.getByText('Освобождаете')).toBeTruthy();
    expect(screen.queryByText(/Какие устройства отключить/i)).toBeNull();

    // Возврат: 48 ₽ × 2 места = 96 ₽
    await waitFor(() => {
      expect(screen.getAllByText(/96/).length).toBeGreaterThan(0);
    });
  });

  it('безлимит: экран недоступен', async () => {
    getSubscriptionMock.mockResolvedValue({
      has_subscription: true,
      subscription: makeSubscription({ device_limit: 0 }),
    });
    getDevicesMock.mockResolvedValue({ devices: [], total: 0, device_limit: 0 });
    getDeviceReductionInfoMock.mockResolvedValue({
      available: false,
      current_device_limit: 0,
      min_device_limit: 0,
      can_reduce: 0,
      connected_devices_count: 0,
    });

    render(<SimpleDeviceLimit />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Убавить|−/i })).toBeNull();
    });
  });

  it('на пробной подписке лимит менять нельзя', async () => {
    getSubscriptionMock.mockResolvedValue({
      has_subscription: true,
      subscription: makeSubscription({ device_limit: 5, is_trial: true }),
    });
    getDevicesMock.mockResolvedValue({ devices: [], total: 0, device_limit: 5 });
    getDeviceReductionInfoMock.mockResolvedValue({
      available: false,
      reason: 'trial',
      current_device_limit: 5,
      min_device_limit: 5,
      can_reduce: 0,
      connected_devices_count: 0,
    });

    render(<SimpleDeviceLimit />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/пробной подписке/i)).toBeTruthy();
    });
    const decreaseBtn = screen.queryByRole('button', { name: /Убавить|−/i });
    if (decreaseBtn) {
      expect(decreaseBtn.hasAttribute('disabled')).toBe(true);
    }
  });
});
