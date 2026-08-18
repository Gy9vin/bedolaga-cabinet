import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import SimpleRow from './SimpleRow';
import { Button } from '@/components/primitives/Button/Button';
import { BentoCard } from '@/components/ui/BentoCard';
import { subscriptionApi } from '../../api/subscription';
import { balanceApi } from '../../api/balance';
import { formatPrice, formatShortDate } from '../../utils/format';
import type { ClassicPurchaseOptions, PurchaseSelection } from '../../types';

/**
 * Экран «Подписка» простого режима: период, устройства, автопродление и
 * оплата на одном экране — без ухода в баланс и возврата обратно. Работает
 * только для классического режима продаж (periods/devices/servers единые
 * на аккаунт); для тарифного режима (sales_mode='tariffs', отдельные
 * тарифы со своими периодами) отдаём ссылку на полный кабинет — там уже
 * есть весь мастер выбора тарифа, а простой экран рассчитан на один общий
 * список периодов, как в макете.
 */
export default function SimpleSubscription() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<number | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

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

  const autopayMutation = useMutation({
    mutationFn: (enabled: boolean) => subscriptionApi.updateAutopay(enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });

  const availableMethods = (paymentMethods ?? []).filter((m) => m.is_available);
  const effectiveMethodId = selectedMethodId ?? availableMethods[0]?.id ?? null;

  const totalKopeks = preview?.total_price_kopeks ?? 0;
  const missingKopeks = Math.max(preview?.missing_amount_kopeks ?? 0, 0);
  const fromBalanceKopeks = Math.max(totalKopeks - missingKopeks, 0);
  const hasEnoughBalance = missingKopeks <= 0;

  const handlePrimaryAction = () => {
    if (hasEnoughBalance) {
      purchaseMutation.mutate();
      return;
    }
    const rubles = Math.ceil(missingKopeks / 100);
    navigate(
      `/balance/top-up?amount=${rubles}&returnTo=${encodeURIComponent(location.pathname)}${
        effectiveMethodId ? `&method=${encodeURIComponent(effectiveMethodId)}` : ''
      }`,
    );
  };

  if (subLoading || optionsLoading) {
    return (
      <SimpleScreen title={t('simple.subscription.title')}>
        <div className="skeleton h-40 w-full rounded-2xl" />
      </SimpleScreen>
    );
  }

  if (purchaseOptions && !isClassic) {
    return (
      <SimpleScreen title={t('simple.subscription.title')}>
        <p className="text-sm text-dark-400">{t('simple.subscription.tariffsModeFallback')}</p>
        <Button variant="primary" fullWidth onClick={() => navigate('/subscription/purchase')}>
          {t('simple.subscription.openFull')}
        </Button>
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
                        {period.per_month_price_label}
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
          <div className="divide-y divide-dark-700/40">
            <div className="flex w-full items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-dark-100">{t('simple.subscription.autopayTitle')}</p>
                <p className="mt-0.5 text-sm text-dark-400">
                  {t('simple.subscription.autopaySub', { price: formatPrice(totalKopeks) })}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={subscription.autopay_enabled}
                disabled={autopayMutation.isPending}
                onClick={() => autopayMutation.mutate(!subscription.autopay_enabled)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  subscription.autopay_enabled ? 'bg-accent-500' : 'bg-dark-700/60'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    subscription.autopay_enabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
          <p className="-mt-2 text-xs text-dark-500">{t('simple.subscription.autopayHint')}</p>
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

      {preview && (
        <BentoCard>
          <div className="flex items-start justify-between gap-3 py-1.5">
            <div className="min-w-0">
              <p className="font-medium text-dark-100">
                {selectedPeriod?.label}
                {' · '}
                {t('simple.subscription.devicesCount', { count: effectiveDevices })}
              </p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums text-dark-50">
              {formatPrice(totalKopeks)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3 border-t border-dark-700/40 py-1.5 pt-2.5">
            <div className="min-w-0">
              <p className="font-medium text-dark-100">
                {t('simple.subscription.fromBalanceLabel')}
              </p>
              <p className="mt-0.5 text-xs text-dark-400">
                {t('simple.subscription.fromBalanceSub', {
                  balance: formatPrice(preview.balance_kopeks),
                })}
              </p>
            </div>
            <span className="shrink-0 font-semibold tabular-nums text-dark-50">
              − {formatPrice(fromBalanceKopeks)}
            </span>
          </div>
          {missingKopeks > 0 && (
            <div className="flex items-start justify-between gap-3 border-t border-dark-700/40 py-1.5 pt-2.5">
              <div className="min-w-0">
                <p className="font-semibold text-dark-100">{t('simple.subscription.topUpLabel')}</p>
                <p className="mt-0.5 text-xs text-dark-400">{t('simple.subscription.topUpSub')}</p>
              </div>
              <span className="shrink-0 text-lg font-bold tabular-nums text-warning-400">
                {formatPrice(missingKopeks)}
              </span>
            </div>
          )}
        </BentoCard>
      )}

      {preview && (
        <>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={purchaseMutation.isPending}
            onClick={handlePrimaryAction}
          >
            {hasEnoughBalance
              ? t('simple.subscription.payButton', { price: formatPrice(totalKopeks) })
              : t('simple.subscription.topUpAndPayButton', { price: formatPrice(missingKopeks) })}
          </Button>
          <p className="text-xs text-dark-500">{t('simple.subscription.payHint')}</p>
        </>
      )}

      <div className="divide-y divide-dark-700/40">
        <SimpleRow
          title={t('simple.subscription.historyRowTitle')}
          subtitle={t('simple.subscription.historyRowSub')}
          onClick={() => navigate('/subscription/history')}
          chevron
        />
      </div>

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
