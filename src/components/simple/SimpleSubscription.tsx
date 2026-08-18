import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import SimpleRow from './SimpleRow';
import SimpleGroup from './SimpleGroup';
import { Button } from '@/components/primitives/Button/Button';
import { Switch } from '@/components/primitives/Switch';
import { BentoCard } from '@/components/ui/BentoCard';
import { subscriptionApi } from '../../api/subscription';
import { balanceApi } from '../../api/balance';
import { formatPrice, formatShortDate } from '../../utils/format';
import type {
  ClassicPurchaseOptions,
  PurchaseSelection,
  Tariff,
  TariffsPurchaseOptions,
} from '../../types';

/**
 * Экран «Подписка» простого режима: тариф/период, устройства, автопродление
 * и оплата на одном экране — без ухода в баланс и возврата обратно.
 *
 * Поддерживает оба режима продаж:
 *  - classic: единый список периодов на аккаунт (periods/devices/servers);
 *  - tariffs (по умолчанию в конфиге бота, SALES_MODE=tariffs): сначала
 *    выбор тарифа, затем период внутри него. У тарифа нет мастера — вся
 *    покупка укладывается на этот же один экран, переиспользуя тот же
 *    клиент subscriptionApi.purchaseTariff, что и полный кабинет
 *    (TariffPurchaseForm). Устройства в тарифном режиме на этапе покупки
 *    не меняются (это делает сам тариф) — блок «Устройства» показываем
 *    только в классическом режиме, где период это позволяет.
 */
export default function SimpleSubscription() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<number | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [selectedTariffId, setSelectedTariffId] = useState<number | null>(null);
  const [selectedTariffPeriodDays, setSelectedTariffPeriodDays] = useState<number | null>(null);

  const { data: subscriptionResponse, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
  });
  const subscription = subscriptionResponse?.subscription ?? null;
  const hasSubscription =
    !!subscription && !subscription.is_expired && subscription.status !== 'disabled';

  const { data: purchaseOptions, isLoading: optionsLoading } = useQuery({
    queryKey: ['purchase-options', undefined],
    queryFn: () => subscriptionApi.getPurchaseOptions(),
  });

  const isClassic = purchaseOptions?.sales_mode === 'classic';
  const classicOptions = isClassic ? (purchaseOptions as ClassicPurchaseOptions) : null;
  const periods = classicOptions?.periods ?? [];

  const isTariffsMode = purchaseOptions?.sales_mode === 'tariffs';
  const tariffsOptions = isTariffsMode ? (purchaseOptions as TariffsPurchaseOptions) : null;
  const tariffs = tariffsOptions?.tariffs ?? [];

  const effectiveTariffId =
    selectedTariffId ?? tariffsOptions?.current_tariff_id ?? tariffs[0]?.id ?? null;
  const selectedTariff: Tariff | null =
    tariffs.find((tariff) => tariff.id === effectiveTariffId) ?? null;

  // Периоды тарифа — либо стандартный список из tariff.periods, либо (для
  // суточного тарифа без периодов) один синтетический период на день, как
  // и в полном кабинете (TariffPurchaseForm, ветка isDailyTariff).
  const isDailyTariff =
    !!selectedTariff && (selectedTariff.is_daily || (selectedTariff.daily_price_kopeks ?? 0) > 0);
  const tariffPeriods = useMemo(() => {
    if (!selectedTariff) return [];
    if (selectedTariff.periods.length > 0) return selectedTariff.periods;
    if (isDailyTariff) {
      return [
        {
          days: 1,
          months: 0,
          label: t('simple.subscription.dailyPeriodLabel'),
          price_kopeks: selectedTariff.daily_price_kopeks ?? 0,
          price_label: formatPrice(selectedTariff.daily_price_kopeks ?? 0),
          price_per_month_kopeks: 0,
          price_per_month_label: '',
        },
      ];
    }
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTariff?.id, isDailyTariff]);

  const effectiveTariffPeriodDays = selectedTariffPeriodDays ?? tariffPeriods[0]?.days ?? null;
  const selectedTariffPeriod =
    tariffPeriods.find((period) => period.days === effectiveTariffPeriodDays) ?? null;

  const effectivePeriodId =
    selectedPeriodId ?? classicOptions?.selection.period_id ?? periods[0]?.id ?? null;
  const selectedPeriod = periods.find((p) => p.id === effectivePeriodId) ?? null;

  const effectiveDevices =
    selectedDevices ??
    selectedPeriod?.devices.current ??
    selectedPeriod?.devices.default ??
    classicOptions?.selection.devices ??
    1;

  const currentSelection: PurchaseSelection | null = useMemo(() => {
    if (!selectedPeriod) return null;
    return {
      period_id: selectedPeriod.id,
      period_days: selectedPeriod.period_days,
      traffic_value: selectedPeriod.traffic.current ?? selectedPeriod.traffic.default,
      servers: classicOptions?.selection.servers,
      devices: effectiveDevices,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriod?.id, effectiveDevices, classicOptions?.selection.servers]);

  const { data: preview } = useQuery({
    queryKey: ['purchase-preview', currentSelection],
    queryFn: () => subscriptionApi.previewPurchase(currentSelection as PurchaseSelection),
    enabled: !!currentSelection,
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: balanceApi.getPaymentMethods,
  });

  const purchaseMutation = useMutation({
    mutationFn: () => subscriptionApi.submitPurchase(currentSelection as PurchaseSelection),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options', undefined] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });

  // Тарифная покупка не идёт через previewPurchase/submitPurchase (это
  // API классического режима с единым списком периодов) — у тарифов свой
  // клиент purchaseTariff(tariffId, periodDays, trafficGb?, subscriptionId?),
  // тот же, что использует TariffPurchaseForm в полном кабинете. Возврат
  // недостающей суммы бэкенд для тарифов не считает — считаем на клиенте
  // так же, как это делает TariffPurchaseForm (price − balance_kopeks).
  const purchaseTariffMutation = useMutation({
    mutationFn: () =>
      subscriptionApi.purchaseTariff(
        (selectedTariff as Tariff).id,
        effectiveTariffPeriodDays as number,
        undefined,
        subscription?.id,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-options', undefined] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });

  const autopayMutation = useMutation({
    mutationFn: (enabled: boolean) => subscriptionApi.updateAutopay(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });

  const availableMethods = (paymentMethods ?? []).filter((m) => m.is_available);
  const effectiveMethodId = selectedMethodId ?? availableMethods[0]?.id ?? null;

  // Дата списания автопродления — конец подписки минус «за сколько дней
  // списывать» (находка 7): без даты предупреждение про баланс ссылалось
  // в пустоту, а в макете дата стоит прямо в подписи тумблера.
  const autopayChargeDate = useMemo(() => {
    if (!subscription) return null;
    const endMs = new Date(subscription.end_date).getTime();
    if (!Number.isFinite(endMs)) return null;
    const daysBefore = subscription.autopay_days_before ?? 0;
    return new Date(endMs - daysBefore * 86_400_000).toISOString();
  }, [subscription?.end_date, subscription?.autopay_days_before]);

  const totalKopeks = preview?.total_price_kopeks ?? 0;
  const missingKopeks = Math.max(preview?.missing_amount_kopeks ?? 0, 0);
  const fromBalanceKopeks = Math.max(totalKopeks - missingKopeks, 0);
  const hasEnoughBalance = missingKopeks <= 0;

  // Расшифровка первой строки сводки — «649 ₽ тариф + 360 ₽ за 2 устройства»
  // (находка «в первой строке сводки нет подписи, из чего сложилась сумма»).
  // Строим подпись из готовых строк preview.breakdown, а не пересчитываем
  // сами: неверная расшифровка хуже её отсутствия. breakdown[0] — тариф/
  // период, он приходит от бэкенда всегда первым и безусловно; строку про
  // устройства ищем по label — бэкенд отдаёт её только при реальной
  // доплате сверх включённых в тариф (см. build_preview_payload). Нет
  // доплаты за устройства или breakdown пуст — подписи не будет вовсе.
  const breakdownBaseItem = isClassic ? preview?.breakdown?.[0] : undefined;
  const breakdownDevicesItem = isClassic
    ? preview?.breakdown?.find((item) => item.label === 'Devices')
    : undefined;
  const extraDevicesCount = Math.max(effectiveDevices - (selectedPeriod?.devices.min ?? 0), 0);

  const totalTariffKopeks = selectedTariffPeriod?.price_kopeks ?? 0;
  const tariffBalanceKopeks = tariffsOptions?.balance_kopeks ?? 0;
  const missingTariffKopeks = Math.max(totalTariffKopeks - tariffBalanceKopeks, 0);
  const fromBalanceTariffKopeks = Math.max(totalTariffKopeks - missingTariffKopeks, 0);
  const hasEnoughTariffBalance = missingTariffKopeks <= 0;

  // Единые значения для сводки/кнопки — считаются по активному режиму
  // продаж, чтобы разметку ниже не пришлось дублировать под каждый режим.
  const showSummary = isClassic ? !!preview : !!selectedTariff && !!selectedTariffPeriod;
  const effectiveTotalKopeks = isClassic ? totalKopeks : totalTariffKopeks;
  const effectiveMissingKopeks = isClassic ? missingKopeks : missingTariffKopeks;
  const effectiveFromBalanceKopeks = isClassic ? fromBalanceKopeks : fromBalanceTariffKopeks;
  const effectiveHasEnoughBalance = isClassic ? hasEnoughBalance : hasEnoughTariffBalance;
  const effectiveBalanceKopeks = isClassic ? (preview?.balance_kopeks ?? 0) : tariffBalanceKopeks;
  const isPurchasePending = isClassic
    ? purchaseMutation.isPending
    : purchaseTariffMutation.isPending;

  const handlePrimaryAction = () => {
    if (effectiveHasEnoughBalance) {
      if (isClassic) {
        purchaseMutation.mutate();
      } else {
        purchaseTariffMutation.mutate();
      }
      return;
    }
    // Без сохранённой корзины авто-покупка после пополнения не сработает —
    // бэкенд включает подписку сама только при свежем флаге намерения
    // (тот же приём, что и saveTrialCart на главной). Деньги иначе спишутся,
    // а подписка не активируется — уже случавшийся у владельца баг.
    // Классический режим: previewPurchase сам сохраняет корзину, когда
    // can_purchase=false — просто зовём его ещё раз прямо перед переходом,
    // чтобы флаг был свежим именно в момент клика.
    // Тарифный режим: purchase-preview не используется, поэтому корзину
    // сохраняет saveTariffCart — обёртка над purchase-tariff, трактующая
    // 402 insufficient_funds как «корзина сохранена» (см. saveTrialCart).
    const saveCart = isClassic
      ? subscriptionApi.previewPurchase(currentSelection as PurchaseSelection)
      : subscriptionApi.saveTariffCart(
          (selectedTariff as Tariff).id,
          effectiveTariffPeriodDays as number,
          subscription?.id,
        );
    const rubles = Math.ceil(effectiveMissingKopeks / 100);
    saveCart
      .catch(() => undefined)
      .finally(() => {
        navigate(
          `/balance/top-up?amount=${rubles}&returnTo=${encodeURIComponent(location.pathname)}${
            effectiveMethodId ? `&method=${encodeURIComponent(effectiveMethodId)}` : ''
          }`,
        );
      });
  };

  if (subLoading || optionsLoading) {
    return (
      <SimpleScreen title={t('simple.subscription.title')}>
        <div className="skeleton h-40 w-full rounded-2xl" />
      </SimpleScreen>
    );
  }

  return (
    <SimpleScreen
      title={t(hasSubscription ? 'simple.subscription.title' : 'simple.subscription.titleBuy')}
    >
      {hasSubscription && subscription && (
        <BentoCard>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success-400" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide text-success-400">
              {t('simple.subscription.statusActive')}
            </span>
          </div>
          <p className="mt-2 text-base font-bold text-dark-50">
            {t('simple.subscription.until', { date: formatShortDate(subscription.end_date) })}
          </p>
          <p className="mt-0.5 text-sm text-dark-400">
            {t('simple.subscription.tariffLabel', { name: subscription.tariff_name || '—' })}
            {' · '}
            {t('simple.subscription.devicesCount', { count: subscription.device_limit })}
            {' · '}
            {t('simple.subscription.trafficCount', { count: subscription.traffic_limit_gb })}
          </p>
        </BentoCard>
      )}

      {isTariffsMode && tariffs.length === 0 && (
        <p className="text-sm text-dark-400">{t('simple.subscription.noTariffsAvailable')}</p>
      )}

      {isTariffsMode && tariffs.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.subscription.tariffSectionLabel')}
          </span>
          <div className="mt-2 space-y-2">
            {tariffs.map((tariff) => {
              const isSelected = tariff.id === effectiveTariffId;
              const tariffIsDaily = tariff.is_daily || (tariff.daily_price_kopeks ?? 0) > 0;
              const priceLabel = tariffIsDaily
                ? t('simple.subscription.tariffPriceDaily', {
                    price: formatPrice(tariff.daily_price_kopeks ?? 0),
                  })
                : tariff.periods.length > 0
                  ? t('simple.subscription.tariffPriceFrom', {
                      price: formatPrice(tariff.periods[0].price_kopeks),
                    })
                  : null;
              return (
                <button
                  key={tariff.id}
                  type="button"
                  onClick={() => {
                    setSelectedTariffId(tariff.id);
                    setSelectedTariffPeriodDays(null);
                  }}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-accent-500/60 bg-accent-500/10'
                      : 'border-dark-700/40 bg-dark-900/70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-dark-100">{tariff.name}</div>
                    <div className="mt-0.5 text-xs text-dark-400">
                      {tariff.traffic_limit_label}
                      {' · '}
                      {tariff.device_limit === 0
                        ? t('simple.subscription.devicesUnlimited')
                        : t('simple.subscription.devicesCount', { count: tariff.device_limit })}
                    </div>
                  </div>
                  {priceLabel && (
                    <span className="shrink-0 font-semibold tabular-nums text-dark-50">
                      {priceLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isTariffsMode && selectedTariff && tariffPeriods.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.subscription.period')}
          </span>
          <div className="mt-2 space-y-2">
            {tariffPeriods.map((period) => {
              const isSelected = period.days === effectiveTariffPeriodDays;
              return (
                <button
                  key={period.days}
                  type="button"
                  onClick={() => setSelectedTariffPeriodDays(period.days)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-accent-500/60 bg-accent-500/10'
                      : 'border-dark-700/40 bg-dark-900/70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-dark-100">{period.label}</span>
                      {!!period.discount_percent && (
                        <span className="text-xs font-semibold text-success-400">
                          −{period.discount_percent}%
                        </span>
                      )}
                    </div>
                    {period.months > 1 && (
                      <div className="mt-0.5 text-xs text-dark-400">
                        {t('simple.subscription.perMonthLabel', {
                          price: formatPrice(period.price_per_month_kopeks),
                        })}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-dark-50">
                    {period.price_label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {periods.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.subscription.period')}
          </span>
          <div className="mt-2 space-y-2">
            {periods.map((period) => {
              const isSelected = period.id === effectivePeriodId;
              return (
                <button
                  key={period.id}
                  type="button"
                  onClick={() => setSelectedPeriodId(period.id)}
                  aria-pressed={isSelected}
                  className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-accent-500/60 bg-accent-500/10'
                      : 'border-dark-700/40 bg-dark-900/70'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-dark-100">{period.label}</span>
                      {!!period.discount_percent && (
                        <span className="text-xs font-semibold text-success-400">
                          −{period.discount_percent}%
                        </span>
                      )}
                    </div>
                    {period.months > 1 && (
                      <div className="mt-0.5 text-xs text-dark-400">
                        {t('simple.subscription.perMonthLabel', {
                          price: formatPrice(period.per_month_price_kopeks),
                        })}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-dark-50">
                    {period.price_label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedPeriod && (
        <BentoCard>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-dark-100">
                {t('simple.subscription.devicesRowTitle')}
              </p>
              <p className="mt-0.5 text-sm text-dark-400">
                {t('simple.subscription.devicesRowSub', {
                  included: selectedPeriod.devices.min,
                  priceLabel: selectedPeriod.devices.price_per_device_label,
                })}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                aria-label={t('simple.subscription.devicesDecrease')}
                disabled={effectiveDevices <= selectedPeriod.devices.min}
                onClick={() =>
                  setSelectedDevices(Math.max(selectedPeriod.devices.min, effectiveDevices - 1))
                }
                className="flex h-8 w-8 items-center justify-center rounded-full border border-dark-700/50 text-lg text-dark-200 disabled:opacity-30"
              >
                −
              </button>
              <span className="w-6 text-center font-semibold tabular-nums text-dark-50">
                {effectiveDevices}
              </span>
              <button
                type="button"
                aria-label={t('simple.subscription.devicesIncrease')}
                disabled={effectiveDevices >= selectedPeriod.devices.max}
                onClick={() =>
                  setSelectedDevices(Math.min(selectedPeriod.devices.max, effectiveDevices + 1))
                }
                className="flex h-8 w-8 items-center justify-center rounded-full border border-dark-700/50 text-lg text-dark-200 disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        </BentoCard>
      )}

      {hasSubscription && subscription && (
        <>
          <SimpleGroup>
            <div className="flex w-full items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-dark-100">{t('simple.subscription.autopayTitle')}</p>
                <p className="mt-0.5 text-sm text-dark-400">
                  {autopayChargeDate
                    ? t('simple.subscription.autopaySubWithDate', {
                        price: formatPrice(effectiveTotalKopeks),
                        date: formatShortDate(autopayChargeDate),
                      })
                    : t('simple.subscription.autopaySub', {
                        price: formatPrice(effectiveTotalKopeks),
                      })}
                </p>
              </div>
              <Switch
                checked={subscription.autopay_enabled}
                disabled={autopayMutation.isPending}
                onCheckedChange={(checked) => autopayMutation.mutate(checked)}
              />
            </div>
          </SimpleGroup>
          <p className="-mt-2 text-xs text-dark-500">
            {autopayChargeDate
              ? t('simple.subscription.autopayHint')
              : t('simple.subscription.autopayHintNoDate')}
          </p>
        </>
      )}

      {availableMethods.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.subscription.paymentMethodLabel')}
          </span>
          <div className="mt-2 space-y-2">
            {availableMethods.map((method) => {
              const isSelected = method.id === effectiveMethodId;
              return (
                <button
                  key={method.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedMethodId(method.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-colors ${
                    isSelected
                      ? 'border-accent-500/60 bg-accent-500/10'
                      : 'border-dark-700/40 bg-dark-900/70'
                  }`}
                >
                  <span className="font-medium text-dark-100">{method.name}</span>
                  {method.min_amount_kopeks > 0 && (
                    <span className="text-xs text-dark-400">
                      {t('simple.subscription.paymentMin', {
                        amount: formatPrice(method.min_amount_kopeks),
                      })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-dark-500">{t('simple.subscription.paymentMethodHint')}</p>
        </div>
      )}

      {showSummary && (
        <BentoCard>
          <div className="flex items-start justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <p className="font-medium text-dark-100">
                {isClassic
                  ? `${selectedPeriod?.label} · ${t('simple.subscription.devicesCount', { count: effectiveDevices })}`
                  : `${selectedTariff?.name} · ${selectedTariffPeriod?.label}`}
              </p>
              {breakdownBaseItem && breakdownDevicesItem && (
                <p className="mt-0.5 text-xs text-dark-400">
                  {t('simple.subscription.summaryBaseDevicesHint', {
                    basePrice: breakdownBaseItem.value,
                    devicesPrice: breakdownDevicesItem.value,
                    count: extraDevicesCount,
                  })}
                </p>
              )}
            </div>
            <span className="shrink-0 font-semibold tabular-nums text-dark-50">
              {formatPrice(effectiveTotalKopeks)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-dark-700/40 py-1.5 pt-2.5">
            <div className="min-w-0">
              <p className="font-medium text-dark-100">
                {t('simple.subscription.fromBalanceLabel')}
              </p>
              <p className="mt-0.5 text-xs text-dark-400">
                {t('simple.subscription.fromBalanceSub', {
                  balance: formatPrice(effectiveBalanceKopeks),
                })}
              </p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums text-dark-50">
              − {formatPrice(effectiveFromBalanceKopeks)}
            </span>
          </div>
          {effectiveMissingKopeks > 0 && (
            <div className="flex items-start justify-between gap-3 border-t border-dark-700/40 py-1.5 pt-2.5">
              <div className="min-w-0">
                <p className="font-semibold text-dark-100">{t('simple.subscription.topUpLabel')}</p>
                <p className="mt-0.5 text-xs text-dark-400">{t('simple.subscription.topUpSub')}</p>
              </div>
              <span className="shrink-0 text-lg font-bold tabular-nums text-warning-400">
                {formatPrice(effectiveMissingKopeks)}
              </span>
            </div>
          )}
        </BentoCard>
      )}

      {showSummary && (
        <>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isPurchasePending}
            onClick={handlePrimaryAction}
          >
            {effectiveHasEnoughBalance
              ? t('simple.subscription.payButton', { price: formatPrice(effectiveTotalKopeks) })
              : t('simple.subscription.topUpAndPayButton', {
                  price: formatPrice(effectiveMissingKopeks),
                })}
          </Button>
          <p className="text-xs text-dark-500">{t('simple.subscription.payHint')}</p>
        </>
      )}

      <SimpleGroup>
        <SimpleRow
          title={t('simple.subscription.historyRowTitle')}
          subtitle={t('simple.subscription.historyRowSub')}
          onClick={() => navigate('/subscription/history')}
          chevron
        />
      </SimpleGroup>

      <button
        type="button"
        onClick={() => navigate('/subscription/purchase')}
        className="text-center text-sm font-medium text-accent-400"
      >
        {t('simple.subscription.changeTrafficLink')}
      </button>
    </SimpleScreen>
  );
}
