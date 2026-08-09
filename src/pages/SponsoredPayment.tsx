import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { sponsoredApi, type SponsoredLookupResponse } from '../api/sponsored';
import { useTheme } from '../hooks/useTheme';
import { getGlassColors } from '../utils/glassTheme';
import { useCurrency } from '../hooks/useCurrency';
import { useHaptic } from '../platform';
import InsufficientBalancePrompt from '../components/InsufficientBalancePrompt';
import PriceBreakdown from '../components/PriceBreakdown';
import { WebBackButton } from '../components/WebBackButton';
import { SearchIcon, UserIcon, CheckIcon } from '@/components/icons';

type LookupErrorCode = 'recipient_not_found' | 'recipient_is_self' | 'rate_limited' | 'unknown';

function getLookupErrorCode(err: unknown): LookupErrorCode {
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 429) return 'rate_limited';
    const detail = err.response?.data?.detail;
    const code =
      typeof detail === 'object' && detail ? (detail as { code?: string }).code : undefined;
    if (code === 'recipient_not_found') return 'recipient_not_found';
    if (code === 'recipient_is_self') return 'recipient_is_self';
  }
  return 'unknown';
}

type PayErrorInfo =
  | { code: 'insufficient_balance'; missingKopeks: number }
  | { code: 'period_unavailable' }
  | { code: 'unknown' };

function getPayError(err: unknown): PayErrorInfo {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    const obj = typeof detail === 'object' && detail ? (detail as Record<string, unknown>) : null;
    if (err.response?.status === 402 && obj?.code === 'insufficient_balance') {
      return { code: 'insufficient_balance', missingKopeks: Number(obj.missing_kopeks) || 0 };
    }
    if (err.response?.status === 400 && obj?.code === 'period_unavailable') {
      return { code: 'period_unavailable' };
    }
  }
  return { code: 'unknown' };
}

export default function SponsoredPayment() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  const { formatAmount, currencySymbol } = useCurrency();
  const { impact } = useHaptic();

  const [query, setQuery] = useState('');
  const [lookupData, setLookupData] = useState<SponsoredLookupResponse | null>(null);
  const [lookupError, setLookupError] = useState<LookupErrorCode | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [payError, setPayError] = useState<PayErrorInfo | null>(null);
  const [payResult, setPayResult] = useState<{
    recipient: string;
    periodDays: number;
    amountKopeks: number;
  } | null>(null);

  const lookupMutation = useMutation({
    mutationFn: (q: string) => sponsoredApi.lookup(q),
    onSuccess: (data) => {
      setLookupData(data);
      setLookupError(null);
      setSelectedPeriod(null);
      setPayError(null);
      setPayResult(null);
    },
    onError: (err: unknown) => {
      setLookupData(null);
      setLookupError(getLookupErrorCode(err));
    },
  });

  const payMutation = useMutation({
    mutationFn: (periodDays: number) => sponsoredApi.pay(query.trim(), periodDays),
    onSuccess: (data) => {
      setPayResult({
        recipient: data.recipient_display_name,
        periodDays: data.period_days,
        amountKopeks: data.amount_kopeks,
      });
      setPayError(null);
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
    onError: (err: unknown) => {
      setPayError(getPayError(err));
    },
  });

  const handleLookup = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    impact('light');
    setLookupError(null);
    setLookupData(null);
    setPayResult(null);
    lookupMutation.mutate(trimmed);
  };

  const handlePay = (periodDays: number) => {
    impact('medium');
    setPayError(null);
    payMutation.mutate(periodDays);
  };

  const handleReset = () => {
    setQuery('');
    setLookupData(null);
    setLookupError(null);
    setSelectedPeriod(null);
    setPayError(null);
    setPayResult(null);
  };

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-center gap-3">
        <WebBackButton to="/balance" />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: g.text }}>
            {t('sponsored.title', 'Оплатить подписку другому человеку')}
          </h1>
          <p className="mt-1 text-sm" style={{ color: g.textSecondary }}>
            {t('sponsored.subtitle', 'Найдите получателя и оплатите его подписку с вашего баланса')}
          </p>
        </div>
      </div>

      {/* Success result */}
      {payResult ? (
        <div
          className="rounded-2xl p-6 text-center"
          style={{ background: g.cardBg, border: `1px solid ${g.cardBorder}` }}
        >
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success-400/15">
            <CheckIcon className="h-7 w-7 text-success-400" />
          </div>
          <h2 className="text-lg font-semibold" style={{ color: g.text }}>
            {t('sponsored.successTitle', 'Подписка оплачена')}
          </h2>
          <p className="mt-2 text-sm" style={{ color: g.textSecondary }}>
            {t(
              'sponsored.successDesc',
              '{{recipient}} получил(а) {{days}} дн. подписки на сумму {{amount}} {{currency}}',
              {
                recipient: payResult.recipient,
                days: payResult.periodDays,
                amount: formatAmount(payResult.amountKopeks / 100),
                currency: currencySymbol,
              },
            )}
          </p>
          <button
            onClick={handleReset}
            className="mt-5 w-full rounded-2xl bg-accent-500 py-3.5 text-base font-semibold text-on-accent transition-colors hover:bg-accent-600"
          >
            {t('sponsored.payAnother', 'Оплатить ещё одному человеку')}
          </button>
        </div>
      ) : (
        <>
          {/* Search box */}
          <div
            className="rounded-2xl p-4"
            style={{ background: g.cardBg, border: `1px solid ${g.cardBorder}` }}
          >
            <label className="mb-2 block text-sm font-medium" style={{ color: g.text }}>
              {t('sponsored.recipientLabel', 'Получатель')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder={t('sponsored.recipientPlaceholder', '@ник, telegram id или email')}
                className="input flex-1"
                disabled={lookupMutation.isPending}
              />
              <button
                onClick={handleLookup}
                disabled={!query.trim() || lookupMutation.isPending}
                className="flex items-center gap-2 rounded-2xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-600 disabled:opacity-50"
              >
                {lookupMutation.isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <SearchIcon className="h-4 w-4" />
                )}
                {t('sponsored.searchButton', 'Найти')}
              </button>
            </div>

            {/* Lookup errors */}
            {lookupError && (
              <div className="mt-3 rounded-xl bg-error-400/10 p-3 text-center text-sm text-error-400">
                {lookupError === 'recipient_not_found' &&
                  t('sponsored.errors.recipientNotFound', 'Проверьте ник или ID')}
                {lookupError === 'recipient_is_self' &&
                  t(
                    'sponsored.errors.recipientIsSelf',
                    'Это ваш аккаунт, используйте обычное продление',
                  )}
                {lookupError === 'rate_limited' &&
                  t('sponsored.errors.rateLimited', 'Слишком много попыток, подождите минуту')}
                {lookupError === 'unknown' && t('common.error', 'Произошла ошибка')}
              </div>
            )}
          </div>

          {/* Recipient found */}
          {lookupData && (
            <div
              className="rounded-2xl p-4"
              style={{ background: g.cardBg, border: `1px solid ${g.cardBorder}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
                  style={{ background: g.innerBg, border: `1px solid ${g.innerBorder}` }}
                >
                  <UserIcon className="h-5 w-5 text-dark-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold" style={{ color: g.text }}>
                    {lookupData.recipient_display_name}
                  </div>
                  <div className="text-xs" style={{ color: g.textSecondary }}>
                    {t('common.balance', 'Баланс')}:{' '}
                    {formatAmount(lookupData.payer_balance_kopeks / 100)} {currencySymbol}
                  </div>
                </div>
              </div>

              {/* Period options */}
              {lookupData.options.length === 0 ? (
                <div className="mt-4 text-center text-sm" style={{ color: g.textSecondary }}>
                  {t('sponsored.noOptions', 'Нет доступных вариантов оплаты')}
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {lookupData.options.map((option) => {
                    const isSelected = selectedPeriod === option.period_days;
                    const canAfford = lookupData.payer_balance_kopeks >= option.price_kopeks;

                    return (
                      <button
                        key={option.period_days}
                        onClick={() => {
                          impact('light');
                          setSelectedPeriod(option.period_days);
                          setPayError(null);
                        }}
                        className="w-full rounded-2xl border p-4 text-left transition-all duration-200"
                        style={{
                          background: isSelected
                            ? isDark
                              ? 'rgba(var(--color-accent-400), 0.08)'
                              : 'rgba(var(--color-accent-400), 0.05)'
                            : g.cardBg,
                          borderColor: isSelected ? 'rgb(var(--color-accent-400))' : g.cardBorder,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base font-semibold" style={{ color: g.text }}>
                            {option.period_days} {t('subscription.days', 'дней')}
                          </span>
                          <span className="text-base font-semibold" style={{ color: g.text }}>
                            {formatAmount(option.price_kopeks / 100)} {currencySymbol}
                          </span>
                        </div>
                        {!canAfford && (
                          <div className="mt-1 text-[11px] text-error-400">
                            {t(
                              'subscription.insufficientBalanceAmount',
                              'Недостаточно средств. Не хватает {{missing}}',
                              {
                                missing: `${formatAmount((option.price_kopeks - lookupData.payer_balance_kopeks) / 100)} ${currencySymbol}`,
                              },
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Price breakdown for the selected period */}
              {selectedPeriod &&
                (() => {
                  const selectedOption = lookupData.options.find(
                    (o) => o.period_days === selectedPeriod,
                  );
                  return selectedOption ? (
                    <div className="mt-4">
                      <PriceBreakdown
                        lines={selectedOption.price_lines}
                        totalKopeks={selectedOption.price_kopeks}
                      />
                    </div>
                  ) : null;
                })()}

              {/* Pay errors */}
              {payError?.code === 'insufficient_balance' && (
                <div className="mt-4">
                  <InsufficientBalancePrompt missingAmountKopeks={payError.missingKopeks} compact />
                </div>
              )}
              {payError?.code === 'period_unavailable' && (
                <div className="mt-4 rounded-xl bg-error-400/10 p-3 text-center text-sm text-error-400">
                  {t(
                    'sponsored.errors.periodUnavailable',
                    'Этот период больше недоступен, попробуйте найти получателя ещё раз',
                  )}
                </div>
              )}
              {payError?.code === 'unknown' && (
                <div className="mt-4 rounded-xl bg-error-400/10 p-3 text-center text-sm text-error-400">
                  {t('common.error', 'Произошла ошибка')}
                </div>
              )}

              {/* Pay button */}
              {selectedPeriod && (
                <button
                  onClick={() => handlePay(selectedPeriod)}
                  disabled={payMutation.isPending}
                  className="mt-4 w-full rounded-2xl bg-accent-500 py-3.5 text-base font-semibold text-on-accent transition-colors hover:bg-accent-600 disabled:opacity-50"
                >
                  {payMutation.isPending
                    ? t('common.processing', 'Обработка...')
                    : t('sponsored.payButton', 'Оплатить')}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
