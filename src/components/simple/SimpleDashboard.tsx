import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import SimpleRow from './SimpleRow';
import { Button } from '@/components/primitives/Button/Button';
import { BentoCard } from '@/components/ui/BentoCard';
import { subscriptionApi } from '../../api/subscription';
import { balanceApi } from '../../api/balance';
import { API } from '../../config/constants';
import { formatPrice, formatShortDate } from '../../utils/format';
import { resolveConnectionUrlForUi } from '../../utils/connectionLink';
import { copyToClipboard } from '../../utils/clipboard';

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

  const { data: subscriptionResponse, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });
  const subscription = subscriptionResponse?.subscription ?? null;
  const hasSubscription =
    !!subscription && !subscription.is_expired && subscription.status !== 'disabled';

  const { data: trialInfo } = useQuery({
    queryKey: ['trial-info'],
    queryFn: () => subscriptionApi.getTrialInfo(),
    enabled: !hasSubscription && !subLoading,
  });

  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    queryFn: () => subscriptionApi.getDevices(),
    enabled: hasSubscription,
    staleTime: API.BALANCE_STALE_TIME_MS,
  });

  const { data: connectionLink } = useQuery({
    queryKey: ['connectionLink', undefined],
    queryFn: () => subscriptionApi.getConnectionLink(),
    enabled: hasSubscription,
    retry: false,
  });

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

  const connectionUrl = useMemo(() => {
    if (!connectionLink) return null;
    return resolveConnectionUrlForUi({
      mode: connectionLink.connect_mode,
      subscriptionUrl: connectionLink.subscription_url,
      displayLink: connectionLink.display_link,
      happSchemeLink: connectionLink.happ_scheme_link,
      happCryptLink: connectionLink.happ_cryptolink,
      happCryptoLink: connectionLink.happ_crypto_link,
      happLink: connectionLink.happ_link,
    });
  }, [connectionLink]);

  const handleCopyLink = () => {
    if (connectionUrl) {
      void copyToClipboard(connectionUrl);
    }
  };

  const handleShowQr = () => {
    navigate('/connection/qr', {
      state: { url: connectionUrl, hideLink: connectionLink?.hide_link ?? false },
    });
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

  if (subLoading) {
    return (
      <SimpleScreen brand={t('simple.dashboard.brand')}>
        <div className="skeleton h-40 w-full rounded-2xl" />
      </SimpleScreen>
    );
  }

  return (
    <SimpleScreen brand={t('simple.dashboard.brand')}>
      {hasSubscription && subscription ? (
        <>
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
              {t('simple.dashboard.activeUntil', { date: formatShortDate(subscription.end_date) })}
            </p>
            <TermProgressBar subscription={subscription} />
          </BentoCard>

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
                      price: formatPrice(trialInfo.price_kopeks),
                    })
                  : t('simple.dashboard.heroSubTrialFree', { days: trialInfo.duration_days })}
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
                    price: formatPrice(trialInfo.price_kopeks),
                  })
                : t('simple.dashboard.tryTrialFree', { days: trialInfo.duration_days })}
            </Button>
          )}

          <Button
            variant={trialInfo?.is_available ? 'ghost' : 'primary'}
            size={trialInfo?.is_available ? 'sm' : 'lg'}
            fullWidth
            // Ведём на новый одноэкранный SimpleSubscription (/subscriptions),
            // а не на старый пятишаговый визард полного кабинета — иначе
            // именно на первой покупке простой режим выбрасывает новичка
            // в сложный интерфейс, от которого его должен уводить.
            onClick={() => navigate('/subscriptions')}
          >
            {t('simple.dashboard.choosePlan')}
          </Button>

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
                <div className="divide-y divide-dark-700/40">
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
                </div>
              </div>
            </>
          )}
        </>
      )}

      <div className="divide-y divide-dark-700/40">
        <SimpleRow
          title={t('simple.dashboard.balance')}
          subtitle={t('simple.dashboard.balanceHint')}
          value={formatPrice(balanceData?.balance_kopeks ?? 0)}
          onClick={() => navigate('/balance/top-up')}
          chevron
        />
      </div>
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
}

/** Плитка с показателем и мини-полосой заполнения (как SimpleStat, но с баром). */
function SimpleTile({ label, value, percent, warn, as = 'div', onClick, testId }: SimpleTileProps) {
  const content = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
        {label}
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
