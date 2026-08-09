// @vitest-environment jsdom
/**
 * Тест на обработку ошибок экрана «Оплатить подписку другому человеку»:
 * 404 recipient_not_found на lookup и 402 insufficient_balance на pay
 * должны показывать понятные пользователю сообщения, а не «server error».
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import SponsoredPayment from './SponsoredPayment';
import { sponsoredApi } from '../api/sponsored';

function axiosError(status: number, detail: unknown) {
  const err = new Error('request failed') as Error & {
    isAxiosError: boolean;
    response: { status: number; data: { detail: unknown } };
  };
  err.isAxiosError = true;
  err.response = { status, data: { detail } };
  return err;
}

vi.mock('../api/sponsored', () => ({
  sponsoredApi: {
    lookup: vi.fn(),
    pay: vi.fn(),
  },
}));

vi.mock('../platform', () => ({
  useHaptic: () => ({
    notification: vi.fn(),
    impact: vi.fn(),
  }),
  usePlatform: () => ({
    platform: 'web',
    openLink: vi.fn(),
  }),
}));

vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: (v: number) => v.toFixed(2),
    currencySymbol: '₽',
  }),
}));

vi.mock('../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));

vi.mock('../utils/glassTheme', () => ({
  getGlassColors: () => ({
    text: '#111',
    textSecondary: '#666',
    cardBg: '#fff',
    cardBorder: '#ccc',
    shadow: 'none',
    innerBg: '#f0f0f0',
    innerBorder: '#ddd',
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

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('SponsoredPayment — обработка ошибок', () => {
  it('404 recipient_not_found на поиске показывает «Проверьте ник или ID»', async () => {
    const lookup = sponsoredApi.lookup as ReturnType<typeof vi.fn>;
    lookup.mockRejectedValue(axiosError(404, { code: 'recipient_not_found' }));

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SponsoredPayment />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/ник|telegram/i), {
      target: { value: '@nobody' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Найти|Search/i }));

    await waitFor(() => {
      expect(screen.getByText(/Проверьте ник или ID|Check the username or ID/i)).toBeTruthy();
    });
  });

  it('402 insufficient_balance на оплате показывает InsufficientBalancePrompt с недостающей суммой', async () => {
    const lookup = sponsoredApi.lookup as ReturnType<typeof vi.fn>;
    const pay = sponsoredApi.pay as ReturnType<typeof vi.fn>;

    lookup.mockResolvedValue({
      recipient_display_name: 'Иван Иванов',
      subscription_id: 42,
      options: [{ period_days: 30, price_kopeks: 10000 }],
      payer_balance_kopeks: 5000,
    });
    pay.mockRejectedValue(axiosError(402, { code: 'insufficient_balance', missing_kopeks: 5000 }));

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SponsoredPayment />
      </Wrapper>,
    );

    fireEvent.change(screen.getByPlaceholderText(/ник|telegram/i), {
      target: { value: '@ivan' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Найти|Search/i }));

    await waitFor(() => {
      expect(screen.getByText('Иван Иванов')).toBeTruthy();
    });

    fireEvent.click(screen.getByText(/30 дней|30 days/i));
    fireEvent.click(screen.getByRole('button', { name: /Оплатить$|^Pay$/i }));

    await waitFor(() => {
      expect(
        screen.getAllByText(/Недостаточно средств|Insufficient funds/i).length,
      ).toBeGreaterThan(0);
      // 5000 kopeks missing = 50.00 in the mocked currency formatter
      expect(screen.getAllByText(/50\.00/).length).toBeGreaterThan(0);
    });
  });
});
