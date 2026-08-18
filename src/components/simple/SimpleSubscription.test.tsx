// @vitest-environment jsdom
/**
 * SimpleSubscription — экран «Подписка» простого режима: продление/покупка,
 * устройства, автопродление и оплата на одном экране. Обязательные проверки
 * из брифа задачи 3: при достаточном балансе кнопка говорит «Оплатить» и
 * строки «Пополнить» нет; при нехватке — кнопка про пополнение и сумма
 * равна РАЗНИЦЕ, а не полной стоимости; приписка про списание только с
 * баланса кабинета обязана стоять рядом с тумблером автопродления.
 */
import type React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SimpleSubscription from './SimpleSubscription';
import { subscriptionApi } from '../../api/subscription';
import { balanceApi } from '../../api/balance';
import type {
  ClassicPurchaseOptions,
  TariffsPurchaseOptions,
  PurchasePreview,
  Subscription,
  PaymentMethod,
} from '../../types';

vi.mock('../../api/subscription', () => ({
  subscriptionApi: {
    getSubscription: vi.fn(),
    getPurchaseOptions: vi.fn(),
    previewPurchase: vi.fn(),
    submitPurchase: vi.fn(),
    updateAutopay: vi.fn(),
    purchaseTariff: vi.fn(),
    saveTariffCart: vi.fn(),
  },
}));

vi.mock('../../api/balance', () => ({
  balanceApi: {
    getPaymentMethods: vi.fn(),
    getBalance: vi.fn(),
  },
}));

vi.mock('@/platform', () => ({
  useHaptic: () => ({ notification: vi.fn(), impact: vi.fn() }),
  usePlatform: () => ({
    platform: 'web',
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

const CLASSIC_OPTIONS: ClassicPurchaseOptions = {
  sales_mode: 'classic',
  currency: 'RUB',
  balance_kopeks: 34000,
  balance_label: '340 ₽',
  subscription_id: 1,
  periods: [
    {
      id: 'p1',
      period_days: 90,
      months: 3,
      label: '3 месяца',
      price_kopeks: 100900,
      price_label: '1 009 ₽',
      per_month_price_kopeks: 21600,
      per_month_price_label: '216 ₽ в месяц',
      discount_percent: 13,
      is_available: true,
      traffic: { selectable: false, mode: 'fixed', options: [], default: 200, current: 200 },
      servers: { options: [], min: 0, max: 0, default: [], selected: [] },
      devices: {
        min: 3,
        max: 10,
        default: 3,
        current: 5,
        price_per_device_kopeks: 18000,
        price_per_device_label: '180 ₽ за 3 месяца',
      },
    },
  ],
  traffic: { selectable: false, mode: 'fixed', options: [], default: 200, current: 200 },
  servers: { options: [], min: 0, max: 0, default: [], selected: [] },
  devices: {
    min: 3,
    max: 10,
    default: 3,
    current: 5,
    price_per_device_kopeks: 18000,
    price_per_device_label: '180 ₽ за 3 месяца',
  },
  selection: { period_id: 'p1', period_days: 90, traffic_value: 200, servers: [], devices: 5 },
};

const TARIFFS_OPTIONS: TariffsPurchaseOptions = {
  sales_mode: 'tariffs',
  tariffs: [
    {
      id: 1,
      name: 'Стандарт',
      description: null,
      tier_level: 1,
      traffic_limit_gb: 200,
      traffic_limit_label: '200 ГБ',
      is_unlimited_traffic: false,
      device_limit: 5,
      extra_devices_count: 0,
      servers_count: 1,
      servers: [],
      periods: [
        {
          days: 30,
          months: 1,
          label: '1 месяц',
          price_kopeks: 50000,
          price_label: '500 ₽',
          price_per_month_kopeks: 50000,
          price_per_month_label: '500 ₽ в месяц',
        },
      ],
      is_current: true,
      is_available: true,
    },
  ],
  current_tariff_id: 1,
  balance_kopeks: 100000,
  balance_label: '1 000 ₽',
};

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'sbp',
    name: 'СБП',
    description: null,
    min_amount_kopeks: 5000,
    max_amount_kopeks: 0,
    is_available: true,
  },
];

function makePreview(overrides: Partial<PurchasePreview>): PurchasePreview {
  return {
    total_price_kopeks: 100900,
    total_price_label: '1 009 ₽',
    per_month_price_kopeks: 21600,
    per_month_price_label: '216 ₽',
    breakdown: [{ label: '3 месяца · 5 устройств', value: '1 009 ₽' }],
    balance_kopeks: 34000,
    balance_label: '340 ₽',
    missing_amount_kopeks: 0,
    can_purchase: true,
    ...overrides,
  };
}

const getSubscriptionMock = subscriptionApi.getSubscription as ReturnType<typeof vi.fn>;
const getPurchaseOptionsMock = subscriptionApi.getPurchaseOptions as ReturnType<typeof vi.fn>;
const previewPurchaseMock = subscriptionApi.previewPurchase as ReturnType<typeof vi.fn>;
const getPaymentMethodsMock = balanceApi.getPaymentMethods as ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.clearAllMocks();
  mockNavigate.mockClear();
  await i18n.changeLanguage('ru');
  getSubscriptionMock.mockResolvedValue({
    has_subscription: true,
    subscription: ACTIVE_SUBSCRIPTION,
  });
  getPurchaseOptionsMock.mockResolvedValue(CLASSIC_OPTIONS);
  getPaymentMethodsMock.mockResolvedValue(PAYMENT_METHODS);
});

afterEach(() => cleanup());

describe('SimpleSubscription', () => {
  it('при достаточном балансе кнопка «Оплатить», строки «Пополнить» нет', async () => {
    previewPurchaseMock.mockResolvedValue(
      makePreview({ balance_kopeks: 150000, missing_amount_kopeks: 0, can_purchase: true }),
    );

    render(<SimpleSubscription />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Оплатить/i })).toBeTruthy();
    });
    // Точное совпадение — «Чем пополнить» (заголовок способов оплаты) должен
    // остаться, а вот строка сводки «Пополнить» (недостающая часть) — нет.
    expect(screen.queryByText('Пополнить', { exact: true })).toBeNull();
  });

  it('при нехватке баланса кнопка про пополнение, а сумма — РАЗНИЦА, не полная стоимость', async () => {
    previewPurchaseMock.mockResolvedValue(
      makePreview({ balance_kopeks: 34000, missing_amount_kopeks: 66900, can_purchase: false }),
    );

    render(<SimpleSubscription />, { wrapper: makeWrapper() });

    const btn = await screen.findByRole('button', { name: /Пополнить/i });
    // 669 ₽ (недостающая часть), а не 1009 ₽ (полная стоимость)
    expect(btn.textContent).toMatch(/669/);
    expect(btn.textContent).not.toMatch(/1[\s ]?009/);
  });

  it('приписка про списание только с баланса кабинета — рядом с тумблером автопродления', async () => {
    previewPurchaseMock.mockResolvedValue(makePreview({}));

    render(<SimpleSubscription />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeTruthy();
    });
    expect(screen.getByText(/баланса кабинета/i)).toBeTruthy();
  });

  it('находка 7: у периода на 3 месяца подпись про месяц словами, а итог отличается от неё', async () => {
    previewPurchaseMock.mockResolvedValue(makePreview({}));

    render(<SimpleSubscription />, { wrapper: makeWrapper() });

    // 216 ₽ — цена за месяц (per_month_price_kopeks у периода p1), с явными
    // словами «в месяц», а не голым числом (было раньше — находка 7).
    await waitFor(() => {
      expect(screen.getByText(/216.*в месяц/i)).toBeTruthy();
    });
    // Итог за весь период (1 009 ₽) — отдельная величина, не совпадает с
    // помесячной ценой.
    expect(screen.getByText('1 009 ₽')).toBeTruthy();
  });

  it('разрыв 2: клик по кнопке пополнения (классический режим) заново сохраняет корзину (previewPurchase) ПЕРЕД навигацией', async () => {
    previewPurchaseMock.mockResolvedValue(
      makePreview({ balance_kopeks: 34000, missing_amount_kopeks: 66900, can_purchase: false }),
    );

    render(<SimpleSubscription />, { wrapper: makeWrapper() });

    const btn = await screen.findByRole('button', { name: /Пополнить/i });
    // Автоматический вызов previewPurchase из react-query (на монтировании
    // экрана) уже мог сохранить корзину, но к моменту клика этот флаг может
    // успеть протухнуть — проверяем, что клик порождает СВОЙ, новый вызов,
    // а не просто полагается на старый.
    const callsBeforeClick = previewPurchaseMock.mock.calls.length;

    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
    // Без свежего сохранения корзины прямо перед переходом авто-покупка
    // после пополнения не сработает — деньги спишутся, а подписка не
    // включится (баг, уже случавшийся у владельца).
    expect(previewPurchaseMock.mock.calls.length).toBeGreaterThan(callsBeforeClick);
  });
});

describe('SimpleSubscription — тарифный режим (sales_mode=tariffs)', () => {
  it('показывает выбор тарифа, а не заглушку со ссылкой в полный кабинет', async () => {
    getPurchaseOptionsMock.mockResolvedValue(TARIFFS_OPTIONS);

    render(<SimpleSubscription />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Стандарт')).toBeTruthy();
    });
    // Заглушки-ссылки в полный кабинет из старой реализации быть не должно.
    expect(screen.queryByText(/пока не поддерживает выбор тарифа/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Открыть полный кабинет/i })).toBeNull();
  });

  it('при достаточном балансе кнопка «Оплатить», строки «Пополнить» нет', async () => {
    getPurchaseOptionsMock.mockResolvedValue(TARIFFS_OPTIONS); // баланс 1000 ₽, тариф 500 ₽

    render(<SimpleSubscription />, { wrapper: makeWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Оплатить/i })).toBeTruthy();
    });
    expect(screen.queryByText('Пополнить', { exact: true })).toBeNull();
  });

  it('при нехватке баланса кнопка про пополнение, а сумма — РАЗНИЦА, не полная стоимость тарифа', async () => {
    getPurchaseOptionsMock.mockResolvedValue({
      ...TARIFFS_OPTIONS,
      balance_kopeks: 20000, // 200 ₽ на балансе, тариф стоит 500 ₽ → не хватает 300 ₽
      balance_label: '200 ₽',
    });

    render(<SimpleSubscription />, { wrapper: makeWrapper() });

    const btn = await screen.findByRole('button', { name: /Пополнить/i });
    expect(btn.textContent).toMatch(/300/);
    expect(btn.textContent).not.toMatch(/500/);
  });

  it('разрыв 2: клик по кнопке пополнения (тарифный режим) вызывает saveTariffCart ПЕРЕД навигацией', async () => {
    getPurchaseOptionsMock.mockResolvedValue({
      ...TARIFFS_OPTIONS,
      balance_kopeks: 20000, // не хватает 300 ₽
      balance_label: '200 ₽',
    });

    const saveTariffCartMock = subscriptionApi.saveTariffCart as ReturnType<typeof vi.fn>;
    const callOrder: string[] = [];
    saveTariffCartMock.mockImplementation(async () => {
      callOrder.push('saveTariffCart');
    });
    mockNavigate.mockImplementation(() => {
      callOrder.push('navigate');
    });

    render(<SimpleSubscription />, { wrapper: makeWrapper() });

    const btn = await screen.findByRole('button', { name: /Пополнить/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(callOrder).toContain('navigate');
    });
    // Тарифный режим не проходит через previewPurchase — без явного
    // saveTariffCart корзина вообще никогда не сохраняется (это и есть
    // разрыв 2: кнопка обещает «включится сразу», а на деле бот ждёт флаг
    // намерения, которого нет).
    expect(callOrder).toEqual(['saveTariffCart', 'navigate']);
  });
});
