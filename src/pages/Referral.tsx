import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import QRCode from 'qrcode';
import { referralApi } from '../api/referral';
import { brandingApi } from '../api/branding';
import { useCurrency } from '../hooks/useCurrency';

const CopyIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const ShareIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 8l5-5m0 0l5 5m-5-5v12" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
  </svg>
);

const QrCodeIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
    />
  </svg>
);

const DownloadIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

const WalletIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h5.25A2.25 2.25 0 0121 6v6zm0 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18V6a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 6"
    />
  </svg>
);

export default function Referral() {
  const { t } = useTranslation();
  const { formatAmount, currencySymbol, formatPositive } = useCurrency();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);

  // Withdrawal form state
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const { data: info, isLoading } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
  });

  // Use the referral link from API (points to Telegram bot)
  const referralLink = info?.referral_link || '';

  const { data: terms } = useQuery({
    queryKey: ['referral-terms'],
    queryFn: referralApi.getReferralTerms,
  });

  const { data: referralList } = useQuery({
    queryKey: ['referral-list'],
    queryFn: () => referralApi.getReferralList({ per_page: 10 }),
  });

  const { data: earnings } = useQuery({
    queryKey: ['referral-earnings'],
    queryFn: () => referralApi.getReferralEarnings({ per_page: 10 }),
  });

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: brandingApi.getBranding,
    staleTime: 60000,
  });

  const { data: withdrawalBalance } = useQuery({
    queryKey: ['withdrawal-balance'],
    queryFn: referralApi.getWithdrawalBalance,
    retry: false,
  });

  const { data: withdrawalRequests } = useQuery({
    queryKey: ['withdrawal-requests'],
    queryFn: () => referralApi.getWithdrawalRequests({ per_page: 10 }),
    retry: false,
  });

  const copyLink = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareLink = () => {
    if (!referralLink) return;
    const shareText = t('referral.shareMessage', {
      percent: info?.commission_percent || 0,
      botName: branding?.name || import.meta.env.VITE_APP_NAME || 'Cabinet',
    });

    if (navigator.share) {
      navigator
        .share({
          title: t('referral.title'),
          text: shareText,
          url: referralLink,
        })
        .catch(() => {
          // ignore cancellation errors
        });
      return;
    }

    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
      referralLink,
    )}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
  };

  // Generate QR when modal opens
  useEffect(() => {
    if (!showQrModal || !referralLink) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(referralLink, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch((err) => {
        console.error('QR generation failed:', err);
        if (!cancelled) setShowQrModal(false);
      });
    return () => { cancelled = true; };
  }, [showQrModal, referralLink]);

  const downloadQrCode = useCallback(async () => {
    if (!qrDataUrl) return;
    const fileName = `referral-qr-${info?.referral_code || 'code'}.png`;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: 'image/png' });

      // Mobile share (works in Telegram WebApp)
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch {
      // ignore share errors
    }

    // Fallback: blob download
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Last resort: open in new tab
      window.open(qrDataUrl, '_blank');
    }
  }, [qrDataUrl, info?.referral_code]);

  const handleWithdrawalSubmit = async () => {
    setWithdrawalError(null);
    setWithdrawalSuccess(null);

    const amountRubles = parseFloat(withdrawalAmount);
    if (isNaN(amountRubles) || amountRubles <= 0) {
      setWithdrawalError(t('referral.withdrawal.error'));
      return;
    }

    const amountKopeks = Math.round(amountRubles * 100);

    if (
      withdrawalBalance?.min_amount_kopeks &&
      amountKopeks < withdrawalBalance.min_amount_kopeks
    ) {
      setWithdrawalError(
        t('referral.withdrawal.minAmount', {
          amount: formatAmount(withdrawalBalance.min_amount_kopeks / 100) + ' ' + currencySymbol,
        }),
      );
      return;
    }

    if (withdrawalBalance && amountKopeks > withdrawalBalance.available_kopeks) {
      setWithdrawalError(t('referral.withdrawal.error'));
      return;
    }

    if (!paymentDetails.trim() || paymentDetails.trim().length < 10) {
      setWithdrawalError(t('referral.withdrawal.paymentDetailsHint'));
      return;
    }

    setWithdrawalLoading(true);
    try {
      const result = await referralApi.createWithdrawalRequest({
        amount_kopeks: amountKopeks,
        payment_details: paymentDetails.trim(),
      });

      setWithdrawalSuccess(
        t('referral.withdrawal.successMessage', { id: result.request_id }),
      );
      setWithdrawalAmount('');
      setPaymentDetails('');

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['withdrawal-balance'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawal-requests'] });

      setTimeout(() => setWithdrawalSuccess(null), 6000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setWithdrawalError(
        error.response?.data?.detail || t('referral.withdrawal.error'),
      );
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'badge-warning',
      approved: 'badge-success',
      completed: 'badge-success',
      rejected: 'badge-error',
      cancelled: 'badge-neutral',
    };
    return statusMap[status] || 'badge-neutral';
  };

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  // Show disabled state if referral program is disabled
  if (terms && !terms.is_enabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-dark-800">
          <svg
            className="h-12 w-12 text-dark-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="mb-2 text-2xl font-bold text-dark-100">{t('referral.title')}</h1>
          <p className="text-dark-400">{t('referral.disabled')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-dark-50 sm:text-3xl">{t('referral.title')}</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <div className="bento-card-hover col-span-2 md:col-span-1">
          <div className="text-sm text-dark-400">{t('referral.stats.totalReferrals')}</div>
          <div className="stat-value mt-1">{info?.total_referrals || 0}</div>
          <div className="mt-1 text-sm text-dark-500">
            {info?.active_referrals || 0} {t('referral.stats.activeReferrals').toLowerCase()}
          </div>
        </div>
        <div className="bento-card-hover">
          <div className="text-sm text-dark-400">{t('referral.stats.totalEarnings')}</div>
          <div className="stat-value mt-1 text-success-400">
            {formatPositive(info?.total_earnings_rubles || 0)}
          </div>
        </div>
        <div className="bento-card-hover">
          <div className="text-sm text-dark-400">{t('referral.stats.commissionRate')}</div>
          <div className="stat-value mt-1 text-accent-400">{info?.commission_percent || 0}%</div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="bento-card">
        <h2 className="mb-4 text-lg font-semibold text-dark-100">{t('referral.yourLink')}</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input type="text" readOnly value={referralLink} className="input flex-1" />
          <div className="flex gap-2">
            <button
              onClick={copyLink}
              disabled={!referralLink}
              className={`btn-primary px-5 ${
                copied ? 'bg-success-500 hover:bg-success-500' : ''
              } ${!referralLink ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              <span className="ml-2">{copied ? t('referral.copied') : t('referral.copyLink')}</span>
            </button>
            <button
              onClick={shareLink}
              disabled={!referralLink}
              className={`btn-secondary flex items-center px-5 ${
                !referralLink ? 'cursor-not-allowed opacity-50' : ''
              }`}
            >
              <ShareIcon />
              <span className="ml-2">{t('referral.shareButton')}</span>
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm text-dark-500">
            {t('referral.shareHint', { percent: info?.commission_percent || 0 })}
          </p>
          <button
            onClick={() => setShowQrModal(true)}
            disabled={!referralLink}
            className={`btn-secondary ml-3 flex shrink-0 items-center gap-2 px-4 py-2 ${
              !referralLink ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            <QrCodeIcon />
            <span className="text-sm">{t('referral.qrCode')}</span>
          </button>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQrModal &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowQrModal(false)}
            />
            <div
              className="relative mx-4 w-full max-w-sm rounded-2xl border border-dark-700/50 bg-dark-900 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute right-3 top-3 rounded-lg p-1.5 text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-200"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <h3 className="mb-4 text-center text-lg font-semibold text-dark-100">
                {t('referral.qrCode')}
              </h3>

              {qrDataUrl ? (
                <>
                  <div className="flex justify-center rounded-xl bg-white p-4">
                    <img src={qrDataUrl} alt="QR Code" className="h-64 w-64" />
                  </div>
                  <p className="mt-3 break-all text-center text-xs text-dark-500">{referralLink}</p>
                  <button
                    onClick={downloadQrCode}
                    className="btn-primary mt-4 flex w-full items-center justify-center"
                  >
                    <DownloadIcon />
                    <span className="ml-2">{t('referral.downloadQr')}</span>
                  </button>
                </>
              ) : (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-dark-600 border-t-accent-400" />
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* Program Terms */}
      {terms && (
        <div className="bento-card">
          <h2 className="mb-4 text-lg font-semibold text-dark-100">{t('referral.terms.title')}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-dark-800/30 p-3">
              <div className="text-sm text-dark-500">{t('referral.terms.commission')}</div>
              <div className="mt-1 text-lg font-semibold text-dark-100">
                {terms.commission_percent}%
              </div>
            </div>
            <div className="rounded-xl bg-dark-800/30 p-3">
              <div className="text-sm text-dark-500">{t('referral.terms.minTopup')}</div>
              <div className="mt-1 text-lg font-semibold text-dark-100">
                {formatAmount(terms.minimum_topup_rubles)} {currencySymbol}
              </div>
            </div>
            <div className="rounded-xl bg-dark-800/30 p-3">
              <div className="text-sm text-dark-500">{t('referral.terms.newUserBonus')}</div>
              <div className="mt-1 text-lg font-semibold text-success-400">
                {formatPositive(terms.first_topup_bonus_rubles)}
              </div>
            </div>
            <div className="rounded-xl bg-dark-800/30 p-3">
              <div className="text-sm text-dark-500">{t('referral.terms.inviterBonus')}</div>
              <div className="mt-1 text-lg font-semibold text-success-400">
                {formatPositive(terms.inviter_bonus_rubles)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal CTA Button */}
      {withdrawalBalance && (
        <button
          onClick={() => setShowWithdrawalForm(!showWithdrawalForm)}
          className="group w-full rounded-2xl border border-accent-500/30 bg-gradient-to-r from-accent-500/15 to-accent-600/10 p-4 text-left transition-all hover:border-accent-500/50 hover:from-accent-500/20 hover:to-accent-600/15 active:scale-[0.99]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/20">
                <WalletIcon />
              </div>
              <div>
                <div className="font-semibold text-dark-50">
                  {t('referral.withdrawal.title')}
                </div>
                <div className="mt-0.5 text-sm text-dark-400">
                  {withdrawalBalance.available_kopeks < withdrawalBalance.balance_kopeks ? (
                    <>
                      {t('referral.withdrawal.balance')}:{' '}
                      <span className="text-dark-300">
                        {formatAmount(withdrawalBalance.balance_kopeks / 100)} {currencySymbol}
                      </span>
                      {' · '}
                      {t('referral.withdrawal.available')}:{' '}
                      <span className="font-medium text-accent-400">
                        {formatAmount(withdrawalBalance.available_kopeks / 100)} {currencySymbol}
                      </span>
                    </>
                  ) : (
                    <>
                      {t('referral.withdrawal.available')}:{' '}
                      <span className="font-medium text-accent-400">
                        {formatAmount(withdrawalBalance.available_kopeks / 100)} {currencySymbol}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <svg
              className={`h-5 w-5 text-dark-400 transition-transform duration-200 ${showWithdrawalForm ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </button>
      )}

      {/* Withdrawal Form (collapsible) */}
      <AnimatePresence>
        {withdrawalBalance && showWithdrawalForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="bento-card">
              {/* Balance Stats */}
              <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-dark-800/30 p-3">
                  <div className="text-xs text-dark-500">{t('referral.withdrawal.balance')}</div>
                  <div className="mt-1 font-semibold text-dark-100">
                    {formatAmount(withdrawalBalance.balance_kopeks / 100)} {currencySymbol}
                  </div>
                </div>
                <div className="rounded-xl bg-dark-800/30 p-3">
                  <div className="text-xs text-dark-500">{t('referral.withdrawal.earned')}</div>
                  <div className="mt-1 font-semibold text-dark-100">
                    {formatAmount(withdrawalBalance.total_earned_kopeks / 100)} {currencySymbol}
                  </div>
                </div>
                <div className="rounded-xl bg-dark-800/30 p-3">
                  <div className="text-xs text-dark-500">{t('referral.withdrawal.spent')}</div>
                  <div className="mt-1 font-semibold text-dark-100">
                    {formatAmount(withdrawalBalance.referral_spent_kopeks / 100)} {currencySymbol}
                  </div>
                </div>
                <div className="rounded-xl bg-accent-500/10 border border-accent-500/20 p-3">
                  <div className="text-xs text-accent-400">{t('referral.withdrawal.available')}</div>
                  <div className="mt-1 font-semibold text-accent-300">
                    {formatAmount(withdrawalBalance.available_kopeks / 100)} {currencySymbol}
                  </div>
                </div>
              </div>

              {/* Explanation block — why available != balance */}
              {withdrawalBalance.explanation && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setShowExplanation(!showExplanation)}
                    className="flex items-center gap-1.5 text-sm text-accent-400 transition-colors hover:text-accent-300"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                    </svg>
                    {t('referral.withdrawal.whyNotAll')}
                    <svg
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${showExplanation ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  <AnimatePresence>
                    {showExplanation && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 rounded-xl border border-dark-700/40 bg-dark-800/40 p-4">
                          <p className="mb-3 text-sm text-dark-400">
                            {t('referral.withdrawal.explanationHint')}
                          </p>

                          {/* Breakdown items */}
                          <div className="space-y-2">
                            {/* Earned */}
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-dark-300">{t('referral.withdrawal.earned')}</span>
                              <span className="text-sm font-medium text-success-400">
                                +{formatAmount(withdrawalBalance.total_earned_kopeks / 100)} {currencySymbol}
                              </span>
                            </div>

                            {/* Spent from referral */}
                            {withdrawalBalance.referral_spent_kopeks > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-dark-300">{t('referral.withdrawal.spent')}</span>
                                <span className="text-sm font-medium text-error-400">
                                  -{formatAmount(withdrawalBalance.referral_spent_kopeks / 100)} {currencySymbol}
                                </span>
                              </div>
                            )}

                            {/* Withdrawn */}
                            {withdrawalBalance.withdrawn_kopeks > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-dark-300">{t('referral.withdrawal.withdrawn')}</span>
                                <span className="text-sm font-medium text-error-400">
                                  -{formatAmount(withdrawalBalance.withdrawn_kopeks / 100)} {currencySymbol}
                                </span>
                              </div>
                            )}

                            {/* Approved */}
                            {withdrawalBalance.approved_kopeks > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-dark-300">{t('referral.withdrawal.approved')}</span>
                                <span className="text-sm font-medium text-warning-400">
                                  -{formatAmount(withdrawalBalance.approved_kopeks / 100)} {currencySymbol}
                                </span>
                              </div>
                            )}

                            {/* Pending */}
                            {withdrawalBalance.pending_kopeks > 0 && (
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-dark-300">{t('referral.withdrawal.pending')}</span>
                                <span className="text-sm font-medium text-warning-400">
                                  -{formatAmount(withdrawalBalance.pending_kopeks / 100)} {currencySymbol}
                                </span>
                              </div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-dark-700/50 pt-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-dark-200">{t('referral.withdrawal.available')}</span>
                                <span className="text-sm font-bold text-accent-400">
                                  {formatAmount(withdrawalBalance.available_kopeks / 100)} {currencySymbol}
                                </span>
                              </div>
                            </div>

                            {/* Own funds note */}
                            {withdrawalBalance.balance_kopeks > withdrawalBalance.available_kopeks && withdrawalBalance.only_referral_mode && (
                              <p className="mt-1 text-xs text-dark-500">
                                {t('referral.withdrawal.ownFundsNote', {
                                  amount: formatAmount((withdrawalBalance.balance_kopeks - withdrawalBalance.available_kopeks) / 100) + ' ' + currencySymbol,
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Pending / Approved indicators */}
              {(withdrawalBalance.pending_kopeks > 0 || withdrawalBalance.approved_kopeks > 0) && (
                <div className="mb-4 space-y-2">
                  {withdrawalBalance.approved_kopeks > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-success-500/10 border border-success-500/20 px-4 py-2.5">
                      <svg className="h-4 w-4 shrink-0 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-success-300">
                        {t('referral.withdrawal.approved')}: {formatAmount(withdrawalBalance.approved_kopeks / 100)} {currencySymbol}
                      </span>
                    </div>
                  )}
                  {withdrawalBalance.pending_kopeks > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-warning-500/10 border border-warning-500/20 px-4 py-2.5">
                      <svg className="h-4 w-4 shrink-0 text-warning-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm text-warning-300">
                        {t('referral.withdrawal.pending')}: {formatAmount(withdrawalBalance.pending_kopeks / 100)} {currencySymbol}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Withdrawal Form */}
              {withdrawalBalance.can_withdraw ? (
                <div className="space-y-4">
                  {/* Amount Input */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-dark-300">
                      {t('referral.withdrawal.amount')}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={withdrawalAmount}
                        onChange={(e) => setWithdrawalAmount(e.target.value)}
                        placeholder={t('referral.withdrawal.amountPlaceholder')}
                        className="input w-full pr-16"
                        disabled={withdrawalLoading}
                        min={0}
                        step="0.01"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-dark-500">
                        {currencySymbol}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-xs text-dark-500">
                        {t('referral.withdrawal.minAmount', {
                          amount: formatAmount(withdrawalBalance.min_amount_kopeks / 100) + ' ' + currencySymbol,
                        })}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setWithdrawalAmount(
                            (withdrawalBalance.available_kopeks / 100).toFixed(2),
                          )
                        }
                        className="text-xs font-medium text-accent-400 transition-colors hover:text-accent-300"
                        disabled={withdrawalLoading}
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {/* Payment Details Input */}
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-dark-300">
                      {t('referral.withdrawal.paymentDetails')}
                    </label>
                    <textarea
                      value={paymentDetails}
                      onChange={(e) => setPaymentDetails(e.target.value)}
                      placeholder={t('referral.withdrawal.paymentDetailsPlaceholder')}
                      className="input w-full resize-none"
                      rows={3}
                      disabled={withdrawalLoading}
                    />
                    <p className="mt-1.5 text-xs text-dark-500">
                      {t('referral.withdrawal.paymentDetailsHint')}
                    </p>
                  </div>

                  {/* Error / Success Messages */}
                  <AnimatePresence mode="wait">
                    {withdrawalError && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-start gap-2 rounded-xl border border-error-500/30 bg-error-500/10 p-3"
                      >
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-error-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        <span className="text-sm text-error-400">{withdrawalError}</span>
                      </motion.div>
                    )}
                    {withdrawalSuccess && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex items-start gap-2 rounded-xl border border-success-500/30 bg-success-500/10 p-3"
                      >
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-success-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-success-400">{withdrawalSuccess}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit Button */}
                  <button
                    onClick={handleWithdrawalSubmit}
                    disabled={withdrawalLoading || !withdrawalAmount || !paymentDetails.trim()}
                    className={`btn-primary w-full ${
                      withdrawalLoading || !withdrawalAmount || !paymentDetails.trim()
                        ? 'cursor-not-allowed opacity-50'
                        : ''
                    }`}
                  >
                    {withdrawalLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>{t('referral.withdrawal.submitting')}</span>
                      </div>
                    ) : (
                      t('referral.withdrawal.submit')
                    )}
                  </button>

                  {/* Cooldown info */}
                  {withdrawalBalance.cooldown_days > 0 && (
                    <p className="text-center text-xs text-dark-500">
                      {t('referral.withdrawal.cooldown', { days: withdrawalBalance.cooldown_days })}
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl bg-dark-800/30 px-4 py-6 text-center">
                  <svg
                    className="mx-auto mb-3 h-10 w-10 text-dark-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                  <p className="text-sm text-dark-400">
                    {withdrawalBalance.cannot_withdraw_reason || t('referral.withdrawal.unavailable')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdrawal History */}
      {withdrawalRequests?.items && withdrawalRequests.items.length > 0 && (
        <div className="bento-card">
          <h2 className="mb-4 text-lg font-semibold text-dark-100">
            {t('referral.withdrawal.history')}
          </h2>
          <div className="space-y-3">
            {withdrawalRequests.items.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-dark-700/30 bg-dark-800/30 p-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-dark-100">
                      {formatAmount(req.amount_kopeks / 100)} {currencySymbol}
                    </div>
                    <div className="mt-0.5 text-xs text-dark-500">
                      #{req.id} • {new Date(req.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={getStatusBadge(req.status)}>
                    {t(`referral.withdrawal.status.${req.status}`, req.status)}
                  </span>
                </div>
                {req.payment_details && (
                  <div className="mt-2 text-xs text-dark-500 break-all">
                    {req.payment_details}
                  </div>
                )}
                {req.admin_comment && (
                  <div className="mt-2 rounded-lg bg-dark-700/30 px-3 py-2 text-xs text-dark-400">
                    <span className="font-medium">{t('referral.withdrawal.adminComment')}:</span>{' '}
                    {req.admin_comment}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referrals List */}
      <div className="bento-card">
        <h2 className="mb-4 text-lg font-semibold text-dark-100">{t('referral.yourReferrals')}</h2>
        {referralList?.items && referralList.items.length > 0 ? (
          <div className="space-y-3">
            {referralList.items.map((ref) => (
              <div
                key={ref.id}
                className="flex items-center justify-between rounded-xl border border-dark-700/30 bg-dark-800/30 p-3"
              >
                <div>
                  <div className="font-medium text-dark-100">
                    {ref.first_name || ref.username || `User #${ref.id}`}
                  </div>
                  <div className="mt-0.5 text-xs text-dark-500">
                    {new Date(ref.created_at).toLocaleDateString()}
                  </div>
                </div>
                {ref.has_paid ? (
                  <span className="badge-success">{t('referral.status.paid')}</span>
                ) : (
                  <span className="badge-neutral">{t('referral.status.pending')}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-800">
              <svg
                className="h-8 w-8 text-dark-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                />
              </svg>
            </div>
            <div className="text-dark-400">{t('referral.noReferrals')}</div>
          </div>
        )}
      </div>

      {/* Earnings History */}
      {earnings?.items && earnings.items.length > 0 && (
        <div className="bento-card">
          <h2 className="mb-4 text-lg font-semibold text-dark-100">
            {t('referral.earningsHistory')}
          </h2>
          <div className="space-y-3">
            {earnings.items.map((earning) => (
              <div
                key={earning.id}
                className="flex items-center justify-between rounded-xl border border-dark-700/30 bg-dark-800/30 p-3"
              >
                <div>
                  <div className="text-dark-100">
                    {earning.referral_first_name || earning.referral_username || 'Referral'}
                  </div>
                  <div className="mt-0.5 text-xs text-dark-500">
                    {t(`referral.reasons.${earning.reason}`, earning.reason)} •{' '}
                    {new Date(earning.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="font-semibold text-success-400">
                  {formatPositive(earning.amount_rubles)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
