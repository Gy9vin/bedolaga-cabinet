// @vitest-environment jsdom
/**
 * Тест SubscriptionCardExpired — поведение кнопки «Быстрое продление»
 * для не-суточных подписок должно вести на страницу выбора периода,
 * а не мгновенно списывать фиксированный 1 месяц.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SubscriptionCardExpired from './SubscriptionCardExpired';
import { subscriptionApi } from '../../api/subscription';
import type { Subscription } from '../../types';

// Мокаем API
vi.mock('../../api/subscription', () => ({
  subscriptionApi: {
    renewSubscription: vi.fn(),
    togglePause: vi.fn(),
    purchaseTariff: vi.fn(),
  },
}));

// Мокаем хуки платформы
vi.mock('../../platform/hooks/useHaptic', () => ({
  useHapticFeedback: () => ({
    buttonPressHeavy: vi.fn(),
    buttonPress: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: (v: number) => v.toFixed(2),
    currencySymbol: '₽',
  }),
}));

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));

vi.mock('../../utils/glassTheme', () => ({
  getGlassColors: () => ({
    cardBg: '#fff',
    cardBorder: '#ccc',
    shadow: 'none',
    innerBg: '#f0f0f0',
    innerBorder: '#ddd',
  }),
}));

vi.mock('@/utils/uiLocale', () => ({
  uiLocale: () => 'ru-RU',
}));

const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/' }),
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

/** Базовая истёкшая не-суточная подписка */
const EXPIRED_NON_DAILY: Subscription = {
  id: 42,
  status: 'expired',
  is_daily: false,
  is_trial: false,
  is_limited: false,
  tariff_id: null,
  daily_price_kopeks: null,
  end_date: '2024-01-01T00:00:00Z',
} as unknown as Subscription;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('SubscriptionCardExpired — не-суточная подписка', () => {
  it('клик по кнопке продления ведёт на /subscriptions/:id/renew, НЕ вызывает renewSubscription', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SubscriptionCardExpired
          subscription={EXPIRED_NON_DAILY}
          balanceKopeks={50000}
          balanceRubles={500}
        />
      </Wrapper>,
    );

    // Находим кнопку продления (текст из i18n — ищем по роли + любому тексту)
    // Кнопка есть потому что hasBalance=true (balanceKopeks=50000 >= 100)
    const renewBtn = screen.getByRole('button', { name: /quickRenew|продл|Продл|renew|Renew/i });
    fireEvent.click(renewBtn);

    // navigate должен вести на страницу выбора периода
    expect(mockNavigate).toHaveBeenCalledWith('/subscriptions/42/renew');

    // renewSubscription НЕ должен вызываться
    expect(subscriptionApi.renewSubscription).not.toHaveBeenCalled();
  });

  it('renewSubscription не вызывается даже если navigate мокнут синхронно', () => {
    mockNavigate.mockImplementation(() => {
      /* no-op */
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SubscriptionCardExpired
          subscription={EXPIRED_NON_DAILY}
          balanceKopeks={100000}
          balanceRubles={1000}
        />
      </Wrapper>,
    );

    const renewBtn = screen.getByRole('button', { name: /quickRenew|продл|Продл|renew|Renew/i });
    fireEvent.click(renewBtn);

    expect(subscriptionApi.renewSubscription).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/subscriptions/42/renew');
  });

  it('для disabled суточной (isDisabledDaily) вызывает togglePause, а НЕ navigate на renew', async () => {
    const togglePause = subscriptionApi.togglePause as ReturnType<typeof vi.fn>;
    togglePause.mockResolvedValue(undefined);

    const disabledDaily: Subscription = {
      ...EXPIRED_NON_DAILY,
      id: 7,
      status: 'disabled',
      is_daily: true,
      daily_price_kopeks: 100,
    } as unknown as Subscription;

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SubscriptionCardExpired
          subscription={disabledDaily}
          balanceKopeks={50000}
          balanceRubles={500}
        />
      </Wrapper>,
    );

    const resumeBtn = screen.getByRole('button', { name: /resume|возобн|Возобн|pause|пауз/i });
    fireEvent.click(resumeBtn);

    // togglePause должен быть вызван
    await vi.waitFor(() => expect(togglePause).toHaveBeenCalledWith(7));
    // navigate на /renew НЕ должен быть вызван
    expect(mockNavigate).not.toHaveBeenCalledWith(expect.stringContaining('/renew'));
    // renewSubscription не вызывается
    expect(subscriptionApi.renewSubscription).not.toHaveBeenCalled();
  });
});
