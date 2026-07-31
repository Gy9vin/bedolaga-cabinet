// @vitest-environment jsdom
/**
 * Тесты backup-login плашки в SuccessNotificationModal.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import SuccessNotificationModal from './SuccessNotificationModal';
import { useSuccessNotification } from '../store/successNotification';
import { getBackupLoginSuggestion } from '../api/auth';

vi.mock('../api/auth', () => ({
  getBackupLoginSuggestion: vi.fn(),
  authApi: {},
}));

vi.mock('../api/subscription', () => ({
  subscriptionApi: {
    getSubscriptions: vi.fn().mockResolvedValue({ subscriptions: [] }),
  },
}));

// Мокаем хуки платформы
vi.mock('../hooks/useTelegramSDK', () => ({
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
}));

vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock('../hooks/useCurrency', () => ({
  useCurrency: () => ({
    formatAmount: (v: number) => v.toFixed(2),
    currencySymbol: '₽',
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
  // Сброс zustand-стора между тестами
  useSuccessNotification.setState({ isOpen: false, data: null, closeOthersSignal: 0 });
});

afterEach(() => {
  cleanup();
});

describe('SuccessNotificationModal — backup-login плашка', () => {
  it('показывает плашку при needs_backup=true после оплаты подписки', async () => {
    (getBackupLoginSuggestion as ReturnType<typeof vi.fn>).mockResolvedValue({
      needs_backup: true,
    });

    useSuccessNotification.setState({
      isOpen: true,
      data: { type: 'subscription_purchased' },
      closeOthersSignal: 0,
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SuccessNotificationModal />
      </Wrapper>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Привяжи|Add a backup/i)).toBeTruthy();
    });
  });

  it('НЕ показывает плашку при needs_backup=false', async () => {
    (getBackupLoginSuggestion as ReturnType<typeof vi.fn>).mockResolvedValue({
      needs_backup: false,
    });

    useSuccessNotification.setState({
      isOpen: true,
      data: { type: 'subscription_purchased' },
      closeOthersSignal: 0,
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SuccessNotificationModal />
      </Wrapper>,
    );

    await waitFor(() => {
      // кнопка «Привязать» не должна появиться
      expect(screen.queryByText(/Привязать|Link account/i)).toBeNull();
    });
  });

  it('закрывает плашку при клике «Позже»', async () => {
    (getBackupLoginSuggestion as ReturnType<typeof vi.fn>).mockResolvedValue({
      needs_backup: true,
    });

    useSuccessNotification.setState({
      isOpen: true,
      data: { type: 'subscription_renewed' },
      closeOthersSignal: 0,
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SuccessNotificationModal />
      </Wrapper>,
    );

    await waitFor(() => screen.getByText(/Позже|Later/i));
    fireEvent.click(screen.getByText(/Позже|Later/i));

    await waitFor(() => {
      expect(screen.queryByText(/Привяжи|Add a backup/i)).toBeNull();
    });
  });

  it('НЕ показывает плашку при пополнении баланса (balance_topup)', async () => {
    (getBackupLoginSuggestion as ReturnType<typeof vi.fn>).mockResolvedValue({
      needs_backup: true,
    });

    useSuccessNotification.setState({
      isOpen: true,
      data: { type: 'balance_topup' },
      closeOthersSignal: 0,
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SuccessNotificationModal />
      </Wrapper>,
    );

    // Небольшая пауза чтобы query успел завершиться
    await new Promise((r) => setTimeout(r, 50));

    expect(screen.queryByText(/Привяжи|Add a backup/i)).toBeNull();
  });

  it('скрывает плашку при ошибке API (не ломает модал)', async () => {
    (getBackupLoginSuggestion as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network error'),
    );

    useSuccessNotification.setState({
      isOpen: true,
      data: { type: 'subscription_purchased' },
      closeOthersSignal: 0,
    });

    const Wrapper = makeWrapper();
    render(
      <Wrapper>
        <SuccessNotificationModal />
      </Wrapper>,
    );

    await new Promise((r) => setTimeout(r, 100));

    // Плашка не показывается, модал не падает
    expect(screen.queryByText(/Привяжи|Add a backup/i)).toBeNull();
    // Основной заголовок модала по-прежнему виден
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
