// @vitest-environment jsdom
/**
 * SimpleSponsored — экран «Оплатить подписку другу» простого режима.
 * В расширенном режиме на эту функцию были жалобы: люди не понимали, чью
 * подписку они оплачивают и чей баланс списывается. Обязательные проверки:
 * имя получателя видно рядом с ценой (не только в шапке), баланс подписан
 * «ваш», а не абстрактно, а после оплаты сказано, что продлена подписка
 * именно друга.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SimpleSponsored from './SimpleSponsored';
import { sponsoredApi } from '../../api/sponsored';

vi.mock('../../api/sponsored', () => ({
  sponsoredApi: {
    lookup: vi.fn(),
    pay: vi.fn(),
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
        <MemoryRouter initialEntries={['/sponsored']}>
          <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return Wrapper;
}

const lookupMock = sponsoredApi.lookup as ReturnType<typeof vi.fn>;
const payMock = sponsoredApi.pay as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
  await i18n.changeLanguage('ru');
});

afterEach(() => cleanup());

async function findRecipient(user: ReturnType<typeof userEvent.setup>) {
  const input = screen.getByLabelText(/Кому/i);
  await user.type(input, '@friend');
  await user.click(screen.getByRole('button', { name: /Найти/i }));
}

describe('SimpleSponsored', () => {
  it('после поиска видно, чью подписку оплачивают — имя получателя рядом с ценой', async () => {
    lookupMock.mockResolvedValue({
      recipient_display_name: 'Иван И.',
      subscription_id: 42,
      options: [{ period_days: 30, price_kopeks: 30000 }],
      payer_balance_kopeks: 100000,
    });

    const user = userEvent.setup();
    render(<SimpleSponsored />, { wrapper: makeWrapper() });
    await findRecipient(user);

    // Имя получателя стоит не только в карточке над периодами, но и в
    // строке суммы рядом с ценой (costLabel) — так его видно там, где
    // называется сумма к списанию, а не только в шапке.
    await waitFor(() => {
      expect(screen.getAllByText(/Иван И\./).length).toBeGreaterThan(1);
    });
  });

  it('баланс на экране подписан как «ваш баланс», а не абстрактно', async () => {
    lookupMock.mockResolvedValue({
      recipient_display_name: 'Иван И.',
      subscription_id: 42,
      options: [{ period_days: 30, price_kopeks: 30000 }],
      payer_balance_kopeks: 100000,
    });

    const user = userEvent.setup();
    render(<SimpleSponsored />, { wrapper: makeWrapper() });
    await findRecipient(user);

    // Точный текст строки (exact) — иначе регекс матчит ещё и payHint
    // («Спишем с вашего баланса сразу...»), который начинается так же.
    await waitFor(() => {
      expect(screen.getByText('Спишем с вашего баланса', { exact: true })).toBeTruthy();
    });
    expect(screen.getByText(/На вашем балансе/i)).toBeTruthy();
  });

  it('получатель не найден — понятная ошибка, а не карточка с ценами', async () => {
    lookupMock.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { detail: { code: 'recipient_not_found' } } },
    });

    const user = userEvent.setup();
    render(<SimpleSponsored />, { wrapper: makeWrapper() });
    await findRecipient(user);

    await waitFor(() => {
      expect(screen.getByText(/Проверьте ник или ID/i)).toBeTruthy();
    });
    // «На вашем балансе ...» — из карточки разбивки суммы, которая после
    // неудачного поиска рендериться не должна (в отличие от subtitle
    // экрана, где тоже упоминается «спишем с вашего баланса»).
    expect(screen.queryByText(/На вашем балансе/i)).toBeNull();
  });

  it('после успешной оплаты сказано, что продлена подписка ДРУГА, а не своя', async () => {
    lookupMock.mockResolvedValue({
      recipient_display_name: 'Иван И.',
      subscription_id: 42,
      options: [{ period_days: 30, price_kopeks: 30000 }],
      payer_balance_kopeks: 100000,
    });
    payMock.mockResolvedValue({
      status: 'applied',
      recipient_display_name: 'Иван И.',
      period_days: 30,
      amount_kopeks: 30000,
    });

    const user = userEvent.setup();
    render(<SimpleSponsored />, { wrapper: makeWrapper() });
    await findRecipient(user);

    const payButton = await screen.findByRole('button', { name: /Оплатить другу/i });
    await user.click(payButton);

    await waitFor(() => {
      expect(screen.getByText(/Подписка друга продлена/i)).toBeTruthy();
    });
    expect(screen.getByText(/Иван И\..*30.*дн/i)).toBeTruthy();
  });

  it('недостатка баланса: кнопка предлагает пополнить именно недостающую часть', async () => {
    lookupMock.mockResolvedValue({
      recipient_display_name: 'Иван И.',
      subscription_id: 42,
      options: [{ period_days: 30, price_kopeks: 30000 }],
      payer_balance_kopeks: 10000, // не хватает 200 ₽
    });

    const user = userEvent.setup();
    render(<SimpleSponsored />, { wrapper: makeWrapper() });
    await findRecipient(user);

    const btn = await screen.findByRole('button', { name: /Пополнить/i });
    expect(btn.textContent).toMatch(/200/);
  });
});
