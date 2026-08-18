// @vitest-environment jsdom
/**
 * SimpleReferral — экран «Рефералы» простого режима. Обязательная проверка
 * из брифа задачи 6: при сумме ниже порога вывода кнопка неактивна и виден
 * остаток до порога; при достаточной сумме — кнопка активна. Анкета
 * партнёра в простом режиме не показывается — этот экран её не рендерит
 * вовсе, других отдельных проверок для этого не требуется.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SimpleReferral from './SimpleReferral';
import { referralApi } from '../../api/referral';
import { withdrawalApi } from '../../api/withdrawals';
import { brandingApi } from '../../api/branding';
import type { ReferralInfo, ReferralTerms } from '../../types';
import type { WithdrawalBalanceResponse } from '../../api/withdrawals';

vi.mock('../../api/referral', () => ({
  referralApi: {
    getReferralInfo: vi.fn(),
    getReferralTerms: vi.fn(),
    getReferralList: vi.fn(),
    getReferralEarnings: vi.fn(),
  },
}));

vi.mock('../../api/withdrawals', () => ({
  withdrawalApi: {
    getBalance: vi.fn(),
  },
}));

vi.mock('../../api/branding', () => ({
  brandingApi: {
    getBranding: vi.fn(),
    getTelegramWidgetConfig: vi.fn(),
  },
}));

vi.mock('@/platform', () => ({
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn() }),
  usePlatform: () => ({
    platform: 'web',
    openTelegramLink: vi.fn(),
    haptic: { impact: vi.fn(), notification: vi.fn() },
  }),
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

const REFERRAL_INFO: ReferralInfo = {
  referral_code: '8241',
  referral_link: 'https://cabinet.example.ru/login?ref=8241',
  total_referrals: 7,
  active_referrals: 4,
  total_earnings_kopeks: 124000,
  total_earnings_rubles: 1240,
  commission_percent: 25,
  available_balance_kopeks: 89000,
  available_balance_rubles: 890,
  withdrawn_kopeks: 0,
};

const REFERRAL_TERMS: ReferralTerms = {
  is_enabled: true,
  commission_percent: 25,
  minimum_topup_kopeks: 0,
  minimum_topup_rubles: 0,
  first_topup_bonus_kopeks: 0,
  first_topup_bonus_rubles: 0,
  inviter_bonus_kopeks: 0,
  inviter_bonus_rubles: 0,
  max_commission_payments: 0,
  partner_section_visible: true,
};

const getReferralInfoMock = referralApi.getReferralInfo as ReturnType<typeof vi.fn>;
const getReferralTermsMock = referralApi.getReferralTerms as ReturnType<typeof vi.fn>;
const getReferralListMock = referralApi.getReferralList as ReturnType<typeof vi.fn>;
const getReferralEarningsMock = referralApi.getReferralEarnings as ReturnType<typeof vi.fn>;
const getWithdrawalBalanceMock = withdrawalApi.getBalance as ReturnType<typeof vi.fn>;
const getBrandingMock = brandingApi.getBranding as ReturnType<typeof vi.fn>;
const getTelegramWidgetConfigMock = brandingApi.getTelegramWidgetConfig as ReturnType<typeof vi.fn>;

function makeWithdrawalBalance(
  overrides: Partial<WithdrawalBalanceResponse>,
): WithdrawalBalanceResponse {
  return {
    total_earned: 124000,
    referral_spent: 0,
    withdrawn: 0,
    pending: 0,
    available_referral: 89000,
    available_total: 89000,
    only_referral_mode: true,
    min_amount_kopeks: 100000,
    is_withdrawal_enabled: true,
    can_request: false,
    cannot_request_reason: null,
    requisites_text: '',
    ...overrides,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
  await i18n.changeLanguage('ru');
  getReferralInfoMock.mockResolvedValue(REFERRAL_INFO);
  getReferralTermsMock.mockResolvedValue(REFERRAL_TERMS);
  getReferralListMock.mockResolvedValue({ items: [], total: 0, page: 1, per_page: 8, pages: 0 });
  getReferralEarningsMock.mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    per_page: 8,
    pages: 0,
    total_amount_kopeks: 0,
    total_amount_rubles: 0,
  });
  getBrandingMock.mockResolvedValue({ name: 'Bedolaga VPN' });
  getTelegramWidgetConfigMock.mockResolvedValue({ bot_username: 'bedolaga_bot' });
});

afterEach(() => cleanup());

describe('SimpleReferral', () => {
  it('сумма ниже порога: кнопка вывода неактивна, виден остаток до порога', async () => {
    getWithdrawalBalanceMock.mockResolvedValue(
      makeWithdrawalBalance({
        available_total: 89000,
        min_amount_kopeks: 100000,
        can_request: false,
      }),
    );

    render(<SimpleReferral />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Вывести/i })).toBeTruthy();
    });
    const withdrawBtn = screen.getByRole('button', { name: /Вывести/i });
    expect(withdrawBtn.hasAttribute('disabled')).toBe(true);
    // Остаток: 1000 - 890 = 110 ₽
    expect(screen.getByText(/110/)).toBeTruthy();
  });

  it('сумма достаточна: кнопка вывода активна', async () => {
    getWithdrawalBalanceMock.mockResolvedValue(
      makeWithdrawalBalance({
        available_total: 150000,
        min_amount_kopeks: 100000,
        can_request: true,
      }),
    );

    render(<SimpleReferral />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Вывести/i })).toBeTruthy();
    });
    const withdrawBtn = screen.getByRole('button', { name: /Вывести/i });
    expect(withdrawBtn.hasAttribute('disabled')).toBe(false);
  });
});
