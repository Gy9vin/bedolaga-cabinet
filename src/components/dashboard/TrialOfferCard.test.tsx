// @vitest-environment jsdom
/**
 * TDD-тест для TrialOfferCard: при !canAfford отображается InsufficientBalancePrompt
 * и нажатие кнопки пополнения вызывает saveTrialCart ПЕРЕД навигацией.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import TrialOfferCard from './TrialOfferCard';
import { subscriptionApi } from '../../api/subscription';
import type { TrialInfo } from '../../types';

// Мокаем API
vi.mock('../../api/subscription', () => ({
  subscriptionApi: {
    saveTrialCart: vi.fn(),
    activateTrial: vi.fn(),
  },
}));

// Мокаем хуки платформы
vi.mock('../../hooks/useTelegramSDK', () => ({
  useTelegramSDK: () => ({
    safeAreaInset: { bottom: 0 },
    contentSafeAreaInset: { bottom: 0 },
    isTelegramWebApp: false,
  }),
}));

vi.mock('@/platform', () => ({
  useHaptic: () => ({
    notification: vi.fn(),
    impact: vi.fn(),
  }),
  usePlatform: () => ({
    platform: 'web',
    openLink: vi.fn(),
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

// Мокаем navigate чтобы поймать навигацию на /balance/top-up
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

const PAID_TRIAL_INFO: TrialInfo = {
  is_available: true,
  requires_payment: true,
  price_kopeks: 1000,
  price_rubles: 10,
  duration_days: 7,
  traffic_limit_gb: 100,
  device_limit: 3,
  reason_unavailable: null,
};

const noop = vi.fn();
const pendingMutation = {
  isPending: false,
  mutate: noop,
  isError: false,
  error: null,
} as unknown as import('@tanstack/react-query').UseMutationResult<unknown, unknown, void, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('TrialOfferCard — !canAfford ветка', () => {
  it('при нехватке баланса рендерится InsufficientBalancePrompt с нужной суммой', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <TrialOfferCard
          trialInfo={PAID_TRIAL_INFO}
          balanceKopeks={0}
          balanceRubles={0}
          activateTrialMutation={pendingMutation}
          trialError={null}
        />
      </Wrapper>,
    );

    // InsufficientBalancePrompt показывает «Не хватает» и сумму
    expect(screen.getByText(/Не хватает|missing/i)).toBeTruthy();
    // Кнопка пополнения баланса присутствует
    expect(screen.getByRole('button', { name: /Пополнить баланс|top.up/i })).toBeTruthy();
  });

  it('клик по кнопке пополнения вызывает saveTrialCart ПЕРЕД навигацией', async () => {
    // saveTrialCart завершается мгновенно
    const saveTrialCart = subscriptionApi.saveTrialCart as ReturnType<typeof vi.fn>;
    saveTrialCart.mockResolvedValue(undefined);

    const callOrder: string[] = [];
    saveTrialCart.mockImplementation(async () => {
      callOrder.push('saveTrialCart');
    });
    mockNavigate.mockImplementation(() => {
      callOrder.push('navigate');
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <TrialOfferCard
          trialInfo={PAID_TRIAL_INFO}
          balanceKopeks={0}
          balanceRubles={0}
          activateTrialMutation={pendingMutation}
          trialError={null}
        />
      </Wrapper>,
    );

    const topUpBtn = screen.getByRole('button', { name: /Пополнить баланс|top.up/i });
    fireEvent.click(topUpBtn);

    await waitFor(() => {
      expect(callOrder).toContain('saveTrialCart');
      expect(callOrder).toContain('navigate');
    });

    // saveTrialCart должен быть вызван РАНЬШЕ navigate
    expect(callOrder.indexOf('saveTrialCart')).toBeLessThan(callOrder.indexOf('navigate'));
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/\/balance\/top-up/));
  });

  it('при canAfford=true рендерится кнопка "Оплатить с баланса", а не InsufficientBalancePrompt', () => {
    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <TrialOfferCard
          trialInfo={PAID_TRIAL_INFO}
          balanceKopeks={5000}
          balanceRubles={50}
          activateTrialMutation={pendingMutation}
          trialError={null}
        />
      </Wrapper>,
    );

    // Кнопки пополнения нет
    expect(screen.queryByRole('button', { name: /Пополнить баланс/i })).toBeNull();
    // Есть кнопка оплаты (ru: "Оплатить с баланса" / en: "Pay & Activate")
    expect(screen.getByRole('button', { name: /Оплатить|Pay\s*&\s*Activate/i })).toBeTruthy();
  });
});
