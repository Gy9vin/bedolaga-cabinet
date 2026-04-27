/**
 * Global success notification modal.
 * Shows prominent success messages for balance top-ups and subscription purchases.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useSuccessNotification } from '../store/successNotification';
import { useCurrency } from '../hooks/useCurrency';
import { useTelegramSDK } from '../hooks/useTelegramSDK';
import { useHaptic } from '@/platform';
import { subscriptionApi } from '../api/subscription';

// Icons
const CheckCircleIcon = () => (
  <svg
    className="h-16 w-16"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const WalletIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3"
    />
  </svg>
);

const RocketIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
    />
  </svg>
);

const DevicesIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
    />
  </svg>
);

const TrafficIcon = () => (
  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
    />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CopyIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
    />
  </svg>
);

export default function SuccessNotificationModal() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isOpen = useSuccessNotification((state) => state.isOpen);
  const data = useSuccessNotification((state) => state.data);
  const hide = useSuccessNotification((state) => state.hide);
  const { formatAmount, currencySymbol } = useCurrency();
  const { safeAreaInset, contentSafeAreaInset, isTelegramWebApp } = useTelegramSDK();
  const haptic = useHaptic();

  const safeBottom = isTelegramWebApp
    ? Math.max(safeAreaInset.bottom, contentSafeAreaInset.bottom)
    : 0;

  const handleClose = useCallback(() => {
    hide();
    setLinkCopied(false);
  }, [hide]);

  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopySubscriptionUrl = useCallback(async () => {
    if (!data?.subscriptionUrl) return;
    try {
      await navigator.clipboard.writeText(data.subscriptionUrl);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = data.subscriptionUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setLinkCopied(true);
    haptic.notification('success');
    setTimeout(() => setLinkCopied(false), 3000);
  }, [data?.subscriptionUrl, haptic]);

  const handleGoToConnection = useCallback(() => {
    hide();
    setLinkCopied(false);
    const subId = data?.subscriptionId;
    navigate(subId ? `/connection?sub=${subId}` : '/connection');
  }, [hide, navigate, data?.subscriptionId]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (isOpen) {
      haptic.notification('success');
    }
  }, [isOpen, haptic]);

  // Scroll lock
  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isBalanceTopup = data?.type === 'balance_topup';

  const { data: subsData } = useQuery({
    queryKey: ['subscriptions-list'],
    queryFn: () => subscriptionApi.getSubscriptions(),
    enabled: isOpen && isBalanceTopup,
    staleTime: 30_000,
  });

  const subscriptions = subsData?.subscriptions ?? [];
  const targetSubscription = subscriptions.find((s) => s.status === 'active') ?? subscriptions[0];
  const hasAnySubscription = subscriptions.length > 0;

  if (!isOpen || !data) return null;
  const isSubscription =
    data.type === 'subscription_activated' ||
    data.type === 'subscription_renewed' ||
    data.type === 'subscription_purchased';
  const isDevicesPurchased = data.type === 'devices_purchased';
  const isTrafficPurchased = data.type === 'traffic_purchased';

  // Format amount
  const formattedAmount = data.amountKopeks
    ? `${formatAmount(data.amountKopeks / 100)} ${currencySymbol}`
    : null;

  // Format new balance
  const formattedBalance =
    data.newBalanceKopeks !== undefined
      ? `${formatAmount(data.newBalanceKopeks / 100)} ${currencySymbol}`
      : null;

  // Format expiry date
  const formattedExpiry = data.expiresAt
    ? new Date(data.expiresAt).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  // Determine title and message
  let title = data.title;
  const message = data.message;
  let icon = <CheckCircleIcon />;
  let gradientClass = 'from-success-500 to-success-600';

  if (!title) {
    if (isBalanceTopup) {
      title = t('successNotification.balanceTopup.title', 'Balance topped up!');
      icon = <WalletIcon />;
      gradientClass = 'from-success-500 to-success-600';
    } else if (data.type === 'subscription_activated') {
      title = t('successNotification.subscriptionActivated.title', 'Subscription activated!');
      icon = <RocketIcon />;
      gradientClass = 'from-accent-500 to-purple-600';
    } else if (data.type === 'subscription_renewed') {
      title = t('successNotification.subscriptionRenewed.title', 'Subscription renewed!');
      icon = <RocketIcon />;
      gradientClass = 'from-accent-500 to-purple-600';
    } else if (data.type === 'subscription_purchased') {
      title = t('successNotification.subscriptionPurchased.title', 'Subscription purchased!');
      icon = <RocketIcon />;
      gradientClass = 'from-accent-500 to-purple-600';
    } else if (data.type === 'devices_purchased') {
      title = t('successNotification.devicesPurchased.title', 'Devices added!');
      icon = <DevicesIcon />;
      gradientClass = 'from-blue-500 to-cyan-600';
    } else if (data.type === 'traffic_purchased') {
      title = t('successNotification.trafficPurchased.title', 'Traffic added!');
      icon = <TrafficIcon />;
      gradientClass = 'from-success-500 to-success-600';
    }
  }

  const handleGoToSubscription = () => {
    hide();
    navigate('/subscriptions');
  };

  const handleBuySubscription = () => {
    hide();
    navigate('/subscriptions');
  };

  const handleRenewSubscription = () => {
    hide();
    navigate(
      targetSubscription ? `/subscriptions/${targetSubscription.id}/renew` : '/subscriptions',
    );
  };

  const handleBuyDevices = () => {
    hide();
    navigate(targetSubscription ? `/subscriptions/${targetSubscription.id}` : '/subscriptions');
  };

  const handleGoToBalance = () => {
    hide();
    navigate('/balance');
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div
        className="relative mx-4 w-full max-w-sm overflow-hidden rounded-3xl border border-dark-700/50 bg-dark-900 shadow-2xl"
        style={{
          marginBottom: safeBottom ? `${safeBottom}px` : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 rounded-xl p-2 text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-200"
        >
          <CloseIcon />
        </button>

        {/* Success header with animation */}
        <div
          className={`flex flex-col items-center bg-gradient-to-br ${gradientClass} px-6 pb-8 pt-10`}
        >
          <div className="mb-4 animate-bounce text-white">{icon}</div>
          <h2 className="text-center text-2xl font-bold text-white">{title}</h2>
          {message && <p className="mt-2 text-center text-white/80">{message}</p>}
        </div>

        {/* Details */}
        <div className="space-y-4 p-6">
          {/* Amount */}
          {formattedAmount && (
            <div className="flex items-center justify-between rounded-xl bg-dark-800/50 px-4 py-3">
              <span className="text-dark-400">
                {isBalanceTopup
                  ? t('successNotification.amount', 'Amount')
                  : t('successNotification.price', 'Price')}
              </span>
              <span
                className={`text-lg font-bold ${isDevicesPurchased || isTrafficPurchased ? 'text-dark-100' : 'text-success-400'}`}
              >
                {isDevicesPurchased || isTrafficPurchased ? '' : '+'}
                {formattedAmount}
              </span>
            </div>
          )}

          {/* Devices info (for devices purchase) */}
          {isDevicesPurchased && data.devicesAdded && (
            <div className="flex items-center justify-between rounded-xl bg-dark-800/50 px-4 py-3">
              <span className="text-dark-400">
                {t('successNotification.devicesAdded', 'Devices added')}
              </span>
              <span className="text-lg font-bold text-blue-400">+{data.devicesAdded}</span>
            </div>
          )}

          {isDevicesPurchased && data.newDeviceLimit && (
            <div className="flex items-center justify-between rounded-xl bg-dark-800/50 px-4 py-3">
              <span className="text-dark-400">
                {t('successNotification.totalDevices', 'Total devices')}
              </span>
              <span className="font-semibold text-dark-100">{data.newDeviceLimit}</span>
            </div>
          )}

          {/* Traffic info (for traffic purchase) */}
          {isTrafficPurchased && data.trafficGbAdded && (
            <div className="flex items-center justify-between rounded-xl bg-dark-800/50 px-4 py-3">
              <span className="text-dark-400">
                {t('successNotification.trafficAdded', 'Traffic added')}
              </span>
              <span className="text-lg font-bold text-success-400">+{data.trafficGbAdded} GB</span>
            </div>
          )}

          {isTrafficPurchased && data.newTrafficLimitGb && (
            <div className="flex items-center justify-between rounded-xl bg-dark-800/50 px-4 py-3">
              <span className="text-dark-400">
                {t('successNotification.totalTraffic', 'Total traffic')}
              </span>
              <span className="font-semibold text-dark-100">{data.newTrafficLimitGb} GB</span>
            </div>
          )}

          {/* New balance (for top-up) */}
          {isBalanceTopup && formattedBalance && (
            <div className="flex items-center justify-between rounded-xl bg-dark-800/50 px-4 py-3">
              <span className="text-dark-400">
                {t('successNotification.newBalance', 'New balance')}
              </span>
              <span className="text-lg font-bold text-dark-100">{formattedBalance}</span>
            </div>
          )}

          {/* Tariff name */}
          {data.tariffName && (
            <div className="flex items-center justify-between rounded-xl bg-dark-800/50 px-4 py-3">
              <span className="text-dark-400">{t('successNotification.tariff', 'Tariff')}</span>
              <span className="font-semibold text-dark-100">{data.tariffName}</span>
            </div>
          )}

          {/* Expiry date */}
          {formattedExpiry && (
            <div className="flex items-center justify-between rounded-xl bg-dark-800/50 px-4 py-3">
              <span className="text-dark-400">
                {t('successNotification.validUntil', 'Valid until')}
              </span>
              <span className="font-semibold text-dark-100">{formattedExpiry}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-2">
            {isSubscription && (
              <button
                onClick={handleGoToSubscription}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 py-3.5 font-bold text-white shadow-lg shadow-accent-500/25 transition-all hover:from-accent-400 hover:to-accent-500 active:from-accent-600 active:to-accent-700"
              >
                <RocketIcon />
                <span>{t('successNotification.goToSubscription', 'Go to Subscription')}</span>
              </button>
            )}

            {isBalanceTopup && (
              <>
                {!hasAnySubscription ? (
                  <button
                    onClick={handleBuySubscription}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 py-3.5 font-bold text-white shadow-lg shadow-accent-500/25 transition-all hover:from-accent-400 hover:to-accent-500 active:from-accent-600 active:to-accent-700"
                  >
                    <RocketIcon />
                    <span>{t('successNotification.buySubscription', 'Buy Subscription')}</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleRenewSubscription}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-500 to-accent-600 py-3.5 font-bold text-white shadow-lg shadow-accent-500/25 transition-all hover:from-accent-400 hover:to-accent-500 active:from-accent-600 active:to-accent-700"
                    >
                      <RocketIcon />
                      <span>
                        {t('successNotification.renewSubscription', 'Renew Subscription')}
                      </span>
                    </button>
                    <button
                      onClick={handleBuyDevices}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 py-3.5 font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:from-blue-400 hover:to-cyan-500 active:from-blue-600 active:to-cyan-700"
                    >
                      <DevicesIcon />
                      <span>{t('successNotification.buyDevices', 'Buy Devices')}</span>
                    </button>
                  </>
                )}
                <button
                  onClick={handleGoToBalance}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-dark-700 py-3 font-semibold text-dark-200 transition-colors hover:bg-dark-600 hover:text-dark-100"
                >
                  <WalletIcon />
                  <span>{t('successNotification.goToBalance', 'Go to Balance')}</span>
                </button>
              </>
            )}

            {isDevicesPurchased && (
              <>
                {/* Share instruction */}
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <p className="mb-2 text-center text-sm font-medium text-blue-300">
                    {t('successNotification.shareInstruction.title', 'How to connect a new device')}
                  </p>
                  <ol className="space-y-1 text-left text-xs text-dark-400">
                    <li>
                      1.{' '}
                      {t(
                        'successNotification.shareInstruction.step1',
                        'Copy the link and send it to the new device',
                      )}
                    </li>
                    <li>
                      2.{' '}
                      {t(
                        'successNotification.shareInstruction.step2',
                        'Open the link on the device',
                      )}
                    </li>
                    <li>
                      3.{' '}
                      {t(
                        'successNotification.shareInstruction.step3',
                        'Download the recommended app',
                      )}
                    </li>
                    <li>
                      4.{' '}
                      {t(
                        'successNotification.shareInstruction.step4',
                        'Tap "Add subscription" in the app',
                      )}
                    </li>
                  </ol>
                </div>

                {data.subscriptionUrl && (
                  <button
                    onClick={handleCopySubscriptionUrl}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold transition-all ${
                      linkCopied
                        ? 'bg-success-500/20 text-success-400'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-400 hover:to-cyan-500 active:from-blue-600 active:to-cyan-700'
                    }`}
                  >
                    {linkCopied ? (
                      <>
                        <CheckCircleIcon />
                        <span>{t('successNotification.linkCopied', 'Link copied!')}</span>
                      </>
                    ) : (
                      <>
                        <CopyIcon />
                        <span>{t('successNotification.copyLink', 'Copy subscription link')}</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleGoToConnection}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-dark-700 py-3 font-semibold text-dark-200 transition-colors hover:bg-dark-600 hover:text-dark-100"
                >
                  <DevicesIcon />
                  <span>{t('successNotification.goToConnection', 'Go to setup guide')}</span>
                </button>
              </>
            )}

            {isTrafficPurchased && (
              <button
                onClick={handleGoToSubscription}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-success-500 to-success-600 py-3.5 font-bold text-white shadow-lg shadow-success-500/25 transition-all hover:from-success-400 hover:to-success-500 active:from-success-600 active:to-success-700"
              >
                <TrafficIcon />
                <span>{t('successNotification.goToSubscription', 'Go to Subscription')}</span>
              </button>
            )}

            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-dark-800 py-3 font-semibold text-dark-300 transition-colors hover:bg-dark-700 hover:text-dark-100"
            >
              {t('common.close', 'Close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
}
