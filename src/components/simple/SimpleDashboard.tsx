import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import SimpleRow from './SimpleRow';
import SimpleGroup from './SimpleGroup';
import { Button } from '@/components/primitives/Button/Button';
import { BentoCard } from '@/components/ui/BentoCard';
import { ChevronRightIcon } from '@/components/icons';
import { usePlatform } from '@/platform';
import { useBranding } from '@/hooks/useBranding';
import { useSubscriptionConnection } from '@/hooks/useSubscriptionConnection';
import { subscriptionApi } from '../../api/subscription';
import { balanceApi } from '../../api/balance';
import { API } from '../../config/constants';
import { formatPrice, formatLongDate } from '../../utils/format';
import type { ClassicPurchaseOptions, TariffsPurchaseOptions } from '../../types';

/**
 * Главная простого режима: одна карточка «работает ли подписка» плюс одно
 * главное действие. Пять состояний из брифа: активна / нет подписки
 * (бесплатный триал, платный триал, без триала) / безлимит устройств —
 * все они завязаны на одни и те же поля ответа /subscription и /trial,
 * которые уже использует TrialOfferCard, чтобы не завести свой формат.
 */
export default function SimpleDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openTelegramLink } = usePlatform();
  // Название — из брендинга бота (с запасным значением из окружения), а не
  // из плейсхолдера макета «Бедолага VPN», зашитого в локаль (находка 5).
  const { appName } = useBranding();

  const { data: subscriptionResponse, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });
  const subscription = subscriptionResponse?.subscription ?? null;
  const isFrozen = !!subscription?.is_frozen;
  const frozenDaysBanked = subscription?.frozen_days_banked ?? 0;
  const hasSubscription =
    !!subscription && !subscription.is_expired && subscription.status !== 'disabled';

  const { data: trialInfo } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: !hasSubscription && !subLoading,
  });

  // Только для замыкающей подсказки бесплатного триала («Дальше — обычный
  // тариф от X ₽ в месяц») — тот же ключ кэша, что и у SimpleSubscription,
  // так что при переходе туда повторного запроса не будет.
  const isFreeTrialState =
    !hasSubscription && !!trialInfo?.is_available && !trialInfo.requires_payment;
  const { data: purchaseOptionsForHint } = useQuery({
    queryKey: ['purchase-options', undefined],
    queryFn: () => subscriptionApi.getPurchaseOptions(),
    enabled: isFreeTrialState,
  });

  const minMonthlyPriceKopeks = useMemo(() => {
    if (!purchaseOptionsForHint) return null;
    const prices: number[] =
      purchaseOptionsForHint.sales_mode === 'classic'
        ? (purchaseOptionsForHint as ClassicPurchaseOptions).periods.map(
            (period) => period.per_month_price_kopeks,
          )
        : (purchaseOptionsForHint as TariffsPurchaseOptions).tariffs.flatMap((tariff) =>
            tariff.periods.map((period) => period.price_per_month_kopeks),
          );
    const positive = prices.filter((price) => price > 0);
    return positive.length > 0 ? Math.min(...positive) : null;
  }, [purchaseOptionsForHint]);

  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: () => subscriptionApi.getDevices(),
    enabled: hasSubscription,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });

  const { connectionUrl, handleCopyLink, handleShowQr } =
    useSubscriptionConnection(hasSubscription);

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });

  const activateTrialMutation = useMutation({
    mutationFn: () => subscriptionApi.activateTrial(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['trial-info'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });

  // Тот же приём, что и в SimpleReferral.shareLink: сперва системный шаринг
  // (navigator.share), а если его нет — запасной вариант через Telegram
  // share-URL. Своего механизма здесь не заводим.
  const handleShareSubscription = () => {
    if (!connectionUrl) return;
    if (navigator.share) {
      navigator
        .share({ title: t('simple.dashboard.shareSubscription'), url: connectionUrl })
        .catch(() => {});
      return;
    }
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(connectionUrl)}`;
    openTelegramLink(telegramUrl);
  };

  const handleTrialClick = () => {
    if (!trialInfo) return;
    const canAfford = (balanceData?.balance_kopeks ?? 0) >= trialInfo.price_kopeks;
    if (trialInfo.requires_payment && !canAfford) {
      subscriptionApi
        .saveTrialCart()
        .catch(() => undefined)
        .finally(() => {
          navigate(
            `/balance/top-up?amount=${Math.ceil((trialInfo.price_kopeks - (balanceData?.balance_kopeks ?? 0)) / 100)}&returnTo=/`,
          );
        });
      return;
    }
    activateTrialMutation.mutate();
  };

  // Экран нарисован ради этой проверки (находка 5): у владельца был баг,
  // где цена триала оказывалась ниже минимума платёжного метода — поэтому
  // строка баланса должна прямо говорить, хватит ли денег на списание,
  // а не молча уводить кнопкой «Пополнить».
  const trialBalanceKopeks = balanceData?.balance_kopeks ?? 0;
  const trialCanAfford = !!trialInfo && trialBalanceKopeks >= trialInfo.price_kopeks;
  const trialMissingKopeks = trialInfo
    ? Math.max(trialInfo.price_kopeks - trialBalanceKopeks, 0)
    : 0;

  if (subLoading) {
    return (
      <SimpleScreen brand={appName}>
        <div className="skeleton h-40 w-full rounded-2xl" />
      </SimpleScreen>
    );
  }

  return (
    <SimpleScreen brand={appName} modeChip={t('simple.dashboard.modeChip')}>
      {isFrozen && subscription ? (
        <>
          {/* Hero — заморожена, кликабелен → /subscriptions */}
          <button
            type="button"
            onClick={() => navigate('/subscriptions')}
            className="w-full cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
          >
            <BentoCard size="xl" className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: 'var(--blue-400)' }}
                  aria-hidden="true"
                />
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--blue-400)' }}
                >
                  {t('simple.dashboard.statusFrozen')}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-dark-50">
                {t('simple.dashboard.frozenDaysBanked', { count: frozenDaysBanked })}
              </p>
            </BentoCard>
          </button>

          {/* Подсказка: разморозьте в разделе Подписка */}
          <p className="text-center text-sm text-dark-400">{t('simple.dashboard.frozenHint')}</p>
        </>
      ) : hasSubscription && subscription ? (
        <>
          <button
            type="button"
            onClick={() => navigate('/subscriptions')}
            className="w-full cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
          >
            <BentoCard size="xl" className="text-center">
              <div className="flex items-center justify-center gap-2">
                <span className="h-2 w-2 rounded-full bg-success-400" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wide text-success-400">
                  {t('simple.dashboard.statusConnected')}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold tracking-tight text-dark-50">
                {t('simple.dashboard.daysLeft', { count: subscription.days_left })}
              </p>
              <p className="mt-1 text-sm text-dark-400">
                {t('simple.dashboard.activeUntil', { date: formatLongDate(subscription.end_date) })}
              </p>
              <TermProgressBar subscription={subscription} />
            </BentoCard>
          </button>

          <Button variant="primary" size="lg" fullWidth onClick={() => navigate('/connection')}>
            {t('simple.dashboard.connectDevice')}
          </Button>

          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" size="sm" onClick={handleShowQr}>
              {t('simple.dashboard.showQr')}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCopyLink}>
              {t('simple.dashboard.copyLink')}
            </Button>
          </div>

          <button
            type="button"
            onClick={handleShareSubscription}
            disabled={!connectionUrl}
            className="text-center text-sm font-medium text-accent-400 disabled:opacity-50"
          >
            {t('simple.dashboard.shareSubscription')}
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <SimpleTile
              label={t('simple.dashboard.traffic')}
              value={
                subscription.traffic_limit_gb === 0 ? (
                  '∞'
                ) : (
                  <>
                    {Math.round(subscription.traffic_used_gb)}{' '}
                    <small className="text-sm font-medium text-dark-400">
                      {t('simple.dashboard.trafficValue', { limit: subscription.traffic_limit_gb })}
                    </small>
                  </>
                )
              }
              percent={
                subscription.traffic_limit_gb === 0
                  ? null
                  : Math.min(100, subscription.traffic_used_percent)
              }
            />
            <SimpleTile
              as="button"
              onClick={() => navigate('/subscription/devices')}
              label={t('simple.dashboard.devices')}
              labelChevron
              value={
                subscription.device_limit === 0 ? (
                  '∞'
                ) : (
                  <>
                    {devicesData?.total ?? 0}{' '}
                    <small className="text-sm font-medium text-dark-400">
                      {t('simple.dashboard.devicesValue', { limit: subscription.device_limit })}
                    </small>
                  </>
                )
              }
              percent={
                subscription.device_limit === 0
                  ? null
                  : Math.min(100, ((devicesData?.total ?? 0) / subscription.device_limit) * 100)
              }
              warn={
                subscription.device_limit > 0 &&
                (devicesData?.total ?? 0) >= subscription.device_limit
              }
              testId="devices-bar"
            />
          </div>
        </>
      ) : (
        <>
          <BentoCard size="xl" className="text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-dark-500" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide text-dark-400">
                {t('simple.dashboard.statusNoSub')}
              </span>
            </div>
            <p className="mt-2 text-xl font-bold tracking-tight text-dark-50">
              {t('simple.dashboard.heroTitle')}
            </p>
            <p className="mt-1 text-sm text-dark-400">
              {!trialInfo?.is_available
                ? t('simple.dashboard.heroSubNoTrial')
                : trialInfo.requires_payment
                  ? t('simple.dashboard.heroSubTrialPaid', {
                      days: trialInfo.duration_days,
                      count: trialInfo.duration_days,
                      price: formatPrice(trialInfo.price_kopeks),
                    })
                  : t('simple.dashboard.heroSubTrialFree', {
                      days: trialInfo.duration_days,
                      count: trialInfo.duration_days,
                    })}
            </p>
          </BentoCard>

          {trialInfo?.is_available && (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={activateTrialMutation.isPending}
              onClick={handleTrialClick}
            >
              {trialInfo.requires_payment
                ? t('simple.dashboard.tryTrialPaid', {
                    days: trialInfo.duration_days,
                    count: trialInfo.duration_days,
                    price: formatPrice(trialInfo.price_kopeks),
                  })
                : t('simple.dashboard.tryTrialFree', {
                    days: trialInfo.duration_days,
                    count: trialInfo.duration_days,
                  })}
            </Button>
          )}

          {trialInfo?.is_available ? (
            <button
              type="button"
              className="w-full text-center text-sm font-medium text-accent-400"
              // Ведём на новый одноэкранный SimpleSubscription (/subscriptions),
              // а не на старый пятишаговый визард полного кабинета.
              onClick={() => navigate('/subscriptions')}
            >
              {t('simple.dashboard.choosePlan')}
            </button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => navigate('/subscriptions')}
            >
              {t('simple.dashboard.choosePlan')}
            </Button>
          )}

          {trialInfo?.is_available && (
            <>
              <p className="text-xs text-dark-500">
                {trialInfo.requires_payment
                  ? t('simple.dashboard.trialHintPaid', {
                      price: formatPrice(trialInfo.price_kopeks),
                    })
                  : t('simple.dashboard.trialHintFree')}
              </p>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
                  {t('simple.dashboard.trialComposition')}
                </span>
                <SimpleGroup>
                  <SimpleRow
                    title={t('simple.dashboard.trialDaysRow', { count: trialInfo.duration_days })}
                  />
                  <SimpleRow
                    title={t('simple.dashboard.trialTrafficRow', {
                      count: trialInfo.traffic_limit_gb,
                    })}
                  />
                  <SimpleRow
                    title={t('simple.dashboard.trialDevicesRow', { count: trialInfo.device_limit })}
                  />
                  {trialInfo.requires_payment && (
                    <SimpleRow
                      title={t('simple.dashboard.trialCostRow')}
                      value={formatPrice(trialInfo.price_kopeks)}
                    />
                  )}
                </SimpleGroup>
              </div>

              {trialInfo.requires_payment && (
                <SimpleGroup>
                  <SimpleRow
                    title={t('simple.dashboard.balance')}
                    subtitle={
                      trialCanAfford
                        ? t('simple.dashboard.trialBalanceEnough')
                        : t('simple.dashboard.trialBalanceMissing', {
                            amount: formatPrice(trialMissingKopeks),
                          })
                    }
                    value={formatPrice(trialBalanceKopeks)}
                  />
                </SimpleGroup>
              )}

              {!trialInfo.requires_payment && minMonthlyPriceKopeks !== null && (
                <p className="text-xs text-dark-500">
                  {t('simple.dashboard.trialClosingHint', {
                    price: formatPrice(minMonthlyPriceKopeks),
                  })}
                </p>
              )}
            </>
          )}
        </>
      )}

      {(isFrozen || hasSubscription || !trialInfo?.is_available) && (
        <SimpleGroup>
          <SimpleRow
            title={t('simple.dashboard.balance')}
            subtitle={t('simple.dashboard.balanceHint')}
            value={formatPrice(balanceData?.balance_kopeks ?? 0)}
            onClick={() => navigate('/balance/top-up')}
            chevron
          />
        </SimpleGroup>
      )}
    </SimpleScreen>
  );
}

/** Полоса срока подписки: доля прошедшего времени между началом и концом. */
function TermProgressBar({
  subscription,
}: {
  subscription: { start_date: string; end_date: string };
}) {
  const percent = useMemo(() => {
    const start = new Date(subscription.start_date).getTime();
    const end = new Date(subscription.end_date).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 100;
    const elapsed = Math.min(Math.max(Date.now() - start, 0), end - start);
    return Math.round((elapsed / (end - start)) * 100);
  }, [subscription.start_date, subscription.end_date]);

  return (
    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-dark-700/40">
      <div
        className="h-full rounded-full bg-accent-500"
        style={{ width: `${percent}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

interface SimpleTileProps {
  label: string;
  value: React.ReactNode;
  /** null — безлимит: полосы не рисуем вовсе, а не 0%/100%. */
  percent: number | null;
  warn?: boolean;
  as?: 'div' | 'button';
  onClick?: () => void;
  testId?: string;
  /** Шеврон рядом с подписью — знак, что плитка кликабельна (находка 11). */
  labelChevron?: boolean;
}

/** Плитка с показателем и мини-полосой заполнения (как SimpleStat, но с баром). */
function SimpleTile({
  label,
  value,
  percent,
  warn,
  as = 'div',
  onClick,
  testId,
  labelChevron,
}: SimpleTileProps) {
  const content = (
    <>
      <p className="flex items-center justify-between gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
        <span>{label}</span>
        {labelChevron && <ChevronRightIcon className="size-3 shrink-0 text-dark-50/30" />}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-dark-50">{value}</p>
      {percent !== null && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-dark-700/40"
          data-testid={testId}
        >
          <div
            className={`h-full rounded-full ${warn ? 'bg-warning-400' : 'bg-accent-500'}`}
            style={{ width: `${percent}%` }}
            aria-hidden="true"
          />
        </div>
      )}
    </>
  );

  const className = 'rounded-2xl border border-dark-700/40 bg-dark-900/70 p-3.5 text-left';

  if (as === 'button') {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
