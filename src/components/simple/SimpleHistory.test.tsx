// @vitest-environment jsdom
/**
 * SimpleHistory — история подписки простого режима: сводка (с какой даты
 * клиент, всего оплачено, дней с подпиской) поверх своей ленты событий
 * (SimpleGroup/SimpleRow, находка 1 — раньше здесь был чужой визуальный
 * язык расширенного режима, SubscriptionTimeline). Перерывы
 * (downtime_seconds) и перенесённый остаток (carried_seconds) рисуются
 * прямо в строке события своей подписью.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SimpleHistory from './SimpleHistory';
import { subscriptionApi } from '../../api/subscription';
import type { SubscriptionTimelineEvent } from '../../types/timeline';

vi.mock('../../api/subscription', () => ({
  subscriptionApi: {
    getTimeline: vi.fn(),
  },
}));

vi.mock('../../hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));

vi.mock('@/platform', () => ({
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn() }),
  usePlatform: () => ({
    platform: 'web',
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

const TEN_DAYS_AGO = new Date(Date.now() - 10 * 86_400_000).toISOString();

const EVENTS: SubscriptionTimelineEvent[] = [
  {
    index: 1,
    event_type: 'activation',
    date: TEN_DAYS_AGO,
    period_days: 3,
    amount_kopeks: null,
    prev_end: null,
    new_end: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    downtime_seconds: null,
    carried_seconds: null,
  },
  {
    index: 2,
    event_type: 'purchase',
    date: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    period_days: 30,
    amount_kopeks: 24900,
    prev_end: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    new_end: new Date(Date.now() + 27 * 86_400_000).toISOString(),
    // Разрыв в 4 дня между окончанием триала и оплатой — должен объяснить
    // «дыру» в датах через существующий SubscriptionTimeline.
    downtime_seconds: 4 * 86_400,
    carried_seconds: null,
  },
];

const getTimelineMock = subscriptionApi.getTimeline as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('ru');
  getTimelineMock.mockResolvedValue({ events: EVENTS, since: TEN_DAYS_AGO });
});

afterEach(() => cleanup());

describe('SimpleHistory', () => {
  it('сводка сверху: сумма оплаченного и число дней с подпиской посчитаны верно', async () => {
    render(<SimpleHistory />, { wrapper: makeWrapper() });

    await waitFor(() => {
      // Сумма оплаченного — сумма amount_kopeks по событиям (249 ₽; триал бесплатный).
      // Та же сумма появляется и в строке события справа, поэтому
      // совпадений минимум два, а не одно.
      expect(screen.getAllByText(/249/).length).toBeGreaterThanOrEqual(2);
    });
    // Дней с подпиской — календарные дни от `since` (10 дней назад) до сегодня.
    expect(screen.getByText('10')).toBeTruthy();
  });

  it('пробный период показан бесплатным, а не суммой 0 ₽', async () => {
    render(<SimpleHistory />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('бесплатно')).toBeTruthy();
    });
  });

  it('перерыв между подписками виден в строке события своей подписью', async () => {
    render(<SimpleHistory />, { wrapper: makeWrapper() });

    await waitFor(() => {
      // «Перерыв …» — подпись под строкой события (находка 1: собственный
      // список простого режима вместо карточек SubscriptionTimeline).
      expect(screen.getByText(/Перерыв 4 дня без подписки/)).toBeTruthy();
    });
  });

  it('заголовок и статус события собираются из типа и периода, а не из карточки SubscriptionTimeline', async () => {
    render(<SimpleHistory />, { wrapper: makeWrapper() });

    await waitFor(() => {
      // purchase, period_days=30 → «Покупка на 1 месяц»
      expect(screen.getByText('Покупка на 1 месяц')).toBeTruthy();
      // activation, period_days=3 → «Пробный период, 3 дн.»
      expect(screen.getByText(/Пробный период/)).toBeTruthy();
    });
  });
});
