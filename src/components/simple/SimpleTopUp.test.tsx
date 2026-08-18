// @vitest-environment jsdom
/**
 * SimpleTopUp — экран «Баланс · пополнение» простого режима. Обязательные
 * проверки из брифа задачи 5: способ, чей минимум не проходит по введённой
 * сумме, гаснет сразу (а не после перехода к провайдеру); готовая сумма из
 * пресетов подставляется в поле; пустой список пресетов не ломает экран.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SimpleTopUp from './SimpleTopUp';
import { balanceApi } from '../../api/balance';
import type { Balance, PaymentMethod } from '../../types';

vi.mock('../../api/balance', () => ({
  balanceApi: {
    getBalance: vi.fn(),
    getTopupPresets: vi.fn(),
    getPaymentMethods: vi.fn(),
    createTopUp: vi.fn(),
  },
}));

vi.mock('@/platform', () => ({
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn() }),
  usePlatform: () => ({
    platform: 'web',
    openLink: vi.fn(),
    haptic: { impact: vi.fn(), notification: vi.fn() },
  }),
}));

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

const BALANCE: Balance = { balance_kopeks: 34000, balance_rubles: 340 };

const METHODS: PaymentMethod[] = [
  {
    id: 'sbp',
    name: 'СБП',
    description: null,
    min_amount_kopeks: 10000,
    max_amount_kopeks: 0,
    is_available: true,
  },
  {
    id: 'card',
    name: 'Банковская карта',
    description: null,
    min_amount_kopeks: 5000,
    max_amount_kopeks: 0,
    is_available: true,
  },
];

const getBalanceMock = balanceApi.getBalance as ReturnType<typeof vi.fn>;
const getTopupPresetsMock = balanceApi.getTopupPresets as ReturnType<typeof vi.fn>;
const getPaymentMethodsMock = balanceApi.getPaymentMethods as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('ru');
  getBalanceMock.mockResolvedValue(BALANCE);
  getPaymentMethodsMock.mockResolvedValue(METHODS);
});

afterEach(() => cleanup());

describe('SimpleTopUp', () => {
  it('способ, чей минимум не проходит по сумме, недоступен для выбора', async () => {
    getTopupPresetsMock.mockResolvedValue({ presets: [], sales_mode: 'classic' });

    const user = userEvent.setup();
    render(<SimpleTopUp />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /СБП/i })).toBeTruthy();
    });

    const amountInput = screen.getByLabelText(/Сумма/i);
    await user.clear(amountInput);
    await user.type(amountInput, '80');

    // 80 ₽ = 8000 копеек — ниже минимума СБП (10000), но выше минимума карты (5000)
    const sbpBtn = screen.getByRole('button', { name: /СБП/i });
    expect(sbpBtn.hasAttribute('disabled')).toBe(true);
    const cardBtn = screen.getByRole('button', { name: /Банковская карта/i });
    expect(cardBtn.hasAttribute('disabled')).toBe(false);
  });

  it('готовая сумма подставляется в поле', async () => {
    getTopupPresetsMock.mockResolvedValue({
      presets: [{ amount_kopeks: 64900, label_days: 90 }],
      sales_mode: 'classic',
    });

    const user = userEvent.setup();
    render(<SimpleTopUp />, { wrapper: makeWrapper() });

    const presetBtn = await screen.findByRole('button', { name: /649/ });
    await user.click(presetBtn);

    const amountInput = screen.getByLabelText(/Сумма/i) as HTMLInputElement;
    await waitFor(() => {
      expect(amountInput.value).toBe('649');
    });
  });

  it('пустой список готовых сумм не ломает экран', async () => {
    getTopupPresetsMock.mockResolvedValue({ presets: [], sales_mode: 'classic' });

    render(<SimpleTopUp />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText(/Сумма/i)).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /СБП/i })).toBeTruthy();
    });
  });
});
