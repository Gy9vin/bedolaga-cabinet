import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/auth';
import SimpleScreen from './SimpleScreen';
import SimpleRow from './SimpleRow';
import SimpleGroup from './SimpleGroup';
import { Button } from '@/components/primitives/Button/Button';
import { Switch } from '@/components/primitives/Switch';
import { BentoCard } from '@/components/ui/BentoCard';
import { subscriptionApi } from '../../api/subscription';
import { balanceApi } from '../../api/balance';
import { formatPrice, formatLongDate } from '../../utils/format';
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
  const user = useAuthStore((s) => s.user);

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [showFreezeModal, setShowFreezeModal] = useState(false);
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
  const isFrozen = subscription?.is_frozen === true;
  // Замороженная подписка имеет status=disabled, но её нужно показывать
  // как «есть подписка», чтобы можно было разморозить.
  const hasSubscription =
    !!subscription && !subscription.is_expired && (subscription.status !== 'disabled' || isFrozen);

  const canFreeze =
    !isFrozen &&
    subscription?.status === 'active' &&
    !subscription?.is_trial &&
    !subscription?.is_daily &&
    subscription?.freeze_subscriptions_enabled === true;

  const hasVerifiedEmail = !!(user?.email && user?.email_verified);

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

  const [freezeError, setFreezeError] = useState<string | null>(null);
  const freezeMutation = useMutation({
    mutationFn: () => subscriptionApi.freeze(subscription?.id),
    onSuccess: () => {
      setShowFreezeModal(false);
      setFreezeError(null);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (err: unknown) => {
      const code =
        (err as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code ??
        null;
      if (code === 'email_not_verified') {
        setFreezeError('email_not_verified');
      } else {
        setFreezeError('generic');
      }
    },
  });

  const unfreezeMutation = useMutation({
    mutationFn: () => subscriptionApi.unfreeze(subscription?.id),
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

  // Расшифровка первой строки сводки — «из чего сложилась сумма» (находка
  // «в первой строке сводки нет подписи, из чего сложилась цена»).
  // Раньше строку про устройства искали по label === 'Devices' — подпись
  // локализована (бэкенд шлёт её по-русски, а не по-английски) и зависит
  // от режима продаж, так что поиск по конкретному тексту никогда не
  // находил совпадение и подпись не показывалась вовсе. Сопоставлять
  // строки по смыслу — заведомо хрупко: рендерим весь breakdown как
  // пришёл, ничего не считаем и не угадываем на фронте. Доступно только в
  // classic-режиме — эндпоинт покупки тарифа (/purchase-tariff) не даёт
  // preview без побочных эффектов (либо покупает, либо сохраняет корзину),
  // поэтому в tariffs-режиме расшифровки пока нет.
  const breakdownLines = isClassic ? (preview?.breakdown ?? []) : [];

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
      {/* Баннер заморозки — показываем вместо обычного статусного блока */}
      {isFrozen && subscription && (
        <BentoCard>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-warning-400" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide text-warning-400">
              {t('simple.subscription.freeze.status_frozen')}
            </span>
          </div>
          {subscription.frozen_days_banked != null && (
            <p className="mt-2 text-base font-bold text-dark-50">
              {t('simple.subscription.freeze.days_banked', {
                count: subscription.frozen_days_banked,
              })}
            </p>
          )}
          {subscription.frozen_auto_unfreeze_at && (
            <p className="mt-0.5 text-sm text-dark-400">
              {t('simple.subscription.freeze.auto_unfreeze_at', {
                date: formatLongDate(subscription.frozen_auto_unfreeze_at),
              })}
            </p>
          )}
          <div className="mt-4">
            <Button
              variant="primary"
              size="md"
              fullWidth
              loading={unfreezeMutation.isPending}
              onClick={() => unfreezeMutation.mutate()}
            >
              {t('simple.subscription.freeze.unfreeze_button')}
            </Button>
          </div>
        </BentoCard>
      )}

      {hasSubscription && !isFrozen && subscription && (
        <BentoCard>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success-400" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-wide text-success-400">
              {t('simple.subscription.statusActive')}
            </span>
          </div>
          <p className="mt-2 text-base font-bold text-dark-50">
            {t('simple.subscription.until', {
              date: formatLongDate(subscription.end_date, { year: true }),
            })}
          </p>
          <p className="mt-0.5 text-sm text-dark-400">
            {t('simple.subscription.tariffLabel', { name: subscription.tariff_name || '—' })}
            {' · '}
            {subscription.device_limit === 0
              ? t('simple.subscription.devicesUnlimited')
              : t('simple.subscription.devicesCount', { count: subscription.device_limit })}
            {' · '}
            {subscription.traffic_limit_gb === 0
              ? t('simple.subscription.trafficUnlimited')
              : t('simple.subscription.trafficCount', { count: subscription.traffic_limit_gb })}
          </p>
        </BentoCard>
      )}

      {/* Кнопка/CTA заморозки — только для активных незамороженных подписок */}
      {canFreeze && !isFrozen && (
        <>
          {hasVerifiedEmail ? (
            <Button
              variant="outline"
              size="md"
              fullWidth
              onClick={() => {
                setFreezeError(null);
                setShowFreezeModal(true);
              }}
            >
              {t('simple.subscription.freeze.freeze_button')}
            </Button>
          ) : (
            <p className="text-sm text-dark-400">
              {t('simple.subscription.freeze.email_required_cta')}{' '}
              <button
                type="button"
                className="text-accent-400 underline underline-offset-2"
                onClick={() => navigate('/profile')}
              >
                {t('simple.subscription.freeze.email_link')}
              </button>
            </p>
          )}
        </>
      )}

      {/* Модал подтверждения заморозки */}
      {showFreezeModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowFreezeModal(false);
            }
          }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-dark-900 p-6 shadow-xl">
            <h2 className="text-lg font-bold text-dark-50">
              {t('simple.subscription.freeze.modal_title')}
            </h2>
            <p className="mt-3 text-sm text-dark-300">
              {t('simple.subscription.freeze.modal_body', {
                days: subscription?.days_left ?? 0,
              })}
            </p>
            {freezeError === 'email_not_verified' && (
              <p className="mt-3 text-sm text-warning-400">
                {t('simple.subscription.freeze.email_required_cta')}{' '}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={() => {
                    setShowFreezeModal(false);
                    navigate('/profile');
                  }}
                >
                  {t('simple.subscription.freeze.email_link')}
                </button>
              </p>
            )}
            {freezeError === 'generic' && (
              <p className="mt-3 text-sm text-error-400">{t('common.error')}</p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <Button
                variant="primary"
                size="md"
                fullWidth
                loading={freezeMutation.isPending}
                onClick={() => freezeMutation.mutate()}
              >
                {t('simple.subscription.freeze.confirm_button')}
              </Button>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => {
                  setShowFreezeModal(false);
                  setFreezeError(null);
                }}
              >
                {t('simple.subscription.freeze.cancel_button')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!isFrozen && isTariffsMode && tariffs.length === 0 && (
        <p className="text-sm text-dark-400">{t('simple.subscription.noTariffsAvailable')}</p>
      )}

      {!isFrozen && isTariffsMode && tariffs.length > 0 && (
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

      {!isFrozen && isTariffsMode && selectedTariff && tariffPeriods.length > 0 && (
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

      {!isFrozen && periods.length > 0 && (
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

      {!isFrozen && selectedPeriod && (
        <BentoCard>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-dark-100">
                {t('simple.subscription.devicesRowTitle')}
              </p>
              <p className="mt-0.5 text-sm text-dark-400">
                {t('simple.subscription.devicesRowSub', {
                  count: selectedPeriod.devices.min,
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

      {hasSubscription && !isFrozen && subscription && (
        <>
          <SimpleGroup>
            <div className="flex w-full items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-dark-100">{t('simple.subscription.autopayTitle')}</p>
                <p className="mt-0.5 text-sm text-dark-400">
                  {autopayChargeDate
                    ? t('simple.subscription.autopaySubWithDate', {
                        price: formatPrice(effectiveTotalKopeks),
                        date: formatLongDate(autopayChargeDate),
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
            {(() => {
              const hint = t(
                autopayChargeDate
                  ? 'simple.subscription.autopayHint'
                  : 'simple.subscription.autopayHintNoDate',
              );
              const boldPhrase = 'только с баланса кабинета';
              const idx = hint.indexOf(boldPhrase);
              if (idx === -1) return hint;
              return (
                <>
                  {hint.slice(0, idx)}
                  <b>{boldPhrase}</b>
                  {hint.slice(idx + boldPhrase.length)}
                </>
              );
            })()}
          </p>
        </>
      )}

      {!isFrozen && availableMethods.length > 0 && (
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
                  <div className="min-w-0">
                    <div className="font-medium text-dark-100">{method.name}</div>
                    {method.description && (
                      <div className="mt-0.5 text-xs text-dark-400">{method.description}</div>
                    )}
                  </div>
                  {method.min_amount_kopeks > 0 && (
                    <span className="shrink-0 text-xs text-dark-400">
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

      {!isFrozen && showSummary && (
        <BentoCard>
          <div className="flex items-start justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <p className="font-medium text-dark-100">
                {isClassic
                  ? `${selectedPeriod?.label} · ${t('simple.subscription.devicesCount', { count: effectiveDevices })}`
                  : `${selectedTariff?.name} · ${selectedTariffPeriod?.label}`}
              </p>
              {breakdownLines.length > 1 && (
                <p className="mt-0.5 text-xs text-dark-400">
                  {breakdownLines.map((line) => `${line.value} ${line.label}`).join(' + ')}
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

      {!isFrozen && showSummary && (
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
        <SimpleRow
          title={t('simple.subscription.sponsoredRowTitle')}
          subtitle={t('simple.subscription.sponsoredRowSub')}
          onClick={() => navigate('/sponsored')}
          chevron
        />
      </SimpleGroup>
    </SimpleScreen>
  );
}
