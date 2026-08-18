import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import SimpleScreen from './SimpleScreen';
import { Button } from '@/components/primitives/Button/Button';
import { BentoCard } from '@/components/ui/BentoCard';
import { sponsoredApi, type SponsoredLookupResponse } from '../../api/sponsored';
import { formatPrice } from '../../utils/format';
import { CheckIcon, SearchIcon, UserIcon } from '@/components/icons';

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

type PayErrorInfo = { code: 'period_unavailable' } | { code: 'unknown' };

function getPayError(err: unknown): PayErrorInfo {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    const obj = typeof detail === 'object' && detail ? (detail as Record<string, unknown>) : null;
    if (err.response?.status === 400 && obj?.code === 'period_unavailable') {
      return { code: 'period_unavailable' };
    }
  }
  return { code: 'unknown' };
}

/**
 * Экран «Оплатить подписку другу» простого режима — упрощённая версия
 * расширенного SponsoredPayment (src/pages/SponsoredPayment.tsx). Поиск,
 * цены и списание переиспользуют тот же API-клиент (sponsoredApi) и тот же
 * бэкенд (POST /cabinet/sponsored/lookup, /pay).
 *
 * В расширенном режиме на эту функцию были жалобы: люди не понимали, чью
 * подписку они оплачивают и чей баланс списывается. Поэтому здесь имя
 * получателя стоит не только в карточке над периодами, но и прямо в строке
 * суммы (costLabel c {{name}}), а баланс подписан «ваш баланс», а не просто
 * «баланс» — чтобы не читалось как баланс получателя.
 *
 * Дату, до которой продлена подписка получателя, экран не показывает: она
 * получателю не сообщается плательщику даже в /lookup (см. докстринг
 * app/cabinet/routes/sponsored.py — тариф, срок и устройства получателя
 * это чужие данные). Расширенный экран после оплаты по той же причине
 * показывает только число оплаченных дней, а не дату — здесь тот же приём.
 */
export default function SimpleSponsored() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

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
      setSelectedPeriod(data.options.length > 0 ? data.options[0].period_days : null);
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
    setLookupError(null);
    setLookupData(null);
    setPayResult(null);
    lookupMutation.mutate(trimmed);
  };

  const handleReset = () => {
    setQuery('');
    setLookupData(null);
    setLookupError(null);
    setSelectedPeriod(null);
    setPayError(null);
    setPayResult(null);
  };

  const selectedOption = lookupData?.options.find((o) => o.period_days === selectedPeriod) ?? null;
  const totalKopeks = selectedOption?.price_kopeks ?? 0;
  const payerBalanceKopeks = lookupData?.payer_balance_kopeks ?? 0;
  const missingKopeks = Math.max(totalKopeks - payerBalanceKopeks, 0);
  const fromBalanceKopeks = Math.max(totalKopeks - missingKopeks, 0);
  const hasEnoughBalance = missingKopeks <= 0;

  const handleTopUp = () => {
    const rubles = Math.ceil(missingKopeks / 100);
    navigate(`/balance/top-up?amount=${rubles}&returnTo=${encodeURIComponent(location.pathname)}`);
  };

  if (payResult) {
    return (
      <SimpleScreen title={t('simple.sponsored.title')}>
        <BentoCard>
          <div className="flex flex-col items-center py-2 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success-400/15">
              <CheckIcon className="h-7 w-7 text-success-400" />
            </div>
            <h2 className="text-lg font-semibold text-dark-50">
              {t('simple.sponsored.successTitle')}
            </h2>
            <p className="mt-2 text-sm text-dark-400">
              {t('simple.sponsored.successDesc', {
                recipient: payResult.recipient,
                days: payResult.periodDays,
                amount: formatPrice(payResult.amountKopeks),
              })}
            </p>
          </div>
        </BentoCard>
        <Button variant="primary" size="lg" fullWidth onClick={handleReset}>
          {t('simple.sponsored.payAnotherButton')}
        </Button>
      </SimpleScreen>
    );
  }

  return (
    <SimpleScreen title={t('simple.sponsored.title')}>
      <p className="-mt-2 text-sm text-dark-400">{t('simple.sponsored.subtitle')}</p>

      <div>
        <label
          htmlFor="simple-sponsored-query"
          className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40"
        >
          {t('simple.sponsored.recipientLabel')}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="simple-sponsored-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            placeholder={t('simple.sponsored.recipientPlaceholder')}
            className="min-w-0 flex-1 rounded-2xl border border-dark-700/40 bg-dark-900/70 px-4 py-3 text-dark-50 placeholder:text-dark-600 focus:border-accent-500 focus:outline-none"
            disabled={lookupMutation.isPending}
          />
          <Button
            variant="primary"
            size="lg"
            disabled={!query.trim()}
            loading={lookupMutation.isPending}
            leftIcon={<SearchIcon className="h-4 w-4" />}
            onClick={handleLookup}
          >
            {t('simple.sponsored.searchButton')}
          </Button>
        </div>

        {lookupError && (
          <p className="mt-2 text-sm text-error-400">
            {lookupError === 'recipient_not_found' &&
              t('simple.sponsored.errors.recipientNotFound')}
            {lookupError === 'recipient_is_self' && t('simple.sponsored.errors.recipientIsSelf')}
            {lookupError === 'rate_limited' && t('simple.sponsored.errors.rateLimited')}
            {lookupError === 'unknown' && t('common.error')}
          </p>
        )}
      </div>

      {lookupData && (
        <>
          <BentoCard>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dark-700/40 bg-dark-800/70">
                <UserIcon className="h-5 w-5 text-dark-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-dark-400">{t('simple.sponsored.payingForLabel')}</p>
                <p className="truncate font-semibold text-dark-50">
                  {lookupData.recipient_display_name}
                </p>
              </div>
            </div>
          </BentoCard>

          {lookupData.options.length === 0 ? (
            <p className="text-sm text-dark-400">{t('simple.sponsored.noOptions')}</p>
          ) : (
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
                {t('simple.sponsored.period')}
              </span>
              <div className="mt-2 space-y-2">
                {lookupData.options.map((option) => {
                  const isSelected = option.period_days === selectedPeriod;
                  return (
                    <button
                      key={option.period_days}
                      type="button"
                      onClick={() => {
                        setSelectedPeriod(option.period_days);
                        setPayError(null);
                      }}
                      aria-pressed={isSelected}
                      className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-colors ${
                        isSelected
                          ? 'border-accent-500/60 bg-accent-500/10'
                          : 'border-dark-700/40 bg-dark-900/70'
                      }`}
                    >
                      <span className="font-medium text-dark-100">
                        {t('simple.sponsored.periodDays', { count: option.period_days })}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-dark-50">
                        {formatPrice(option.price_kopeks)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {selectedOption && (
            <BentoCard>
              <div className="flex items-start justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <p className="font-medium text-dark-100">
                    {t('simple.sponsored.costLabel', {
                      name: lookupData.recipient_display_name,
                    })}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-dark-50">
                  {formatPrice(totalKopeks)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-3 border-t border-dark-700/40 py-1.5 pt-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-dark-100">
                    {t('simple.sponsored.fromBalanceLabel')}
                  </p>
                  <p className="mt-0.5 text-xs text-dark-400">
                    {t('simple.sponsored.fromBalanceSub', {
                      balance: formatPrice(payerBalanceKopeks),
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
                    <p className="font-semibold text-dark-100">
                      {t('simple.sponsored.topUpLabel')}
                    </p>
                    <p className="mt-0.5 text-xs text-dark-400">{t('simple.sponsored.topUpSub')}</p>
                  </div>
                  <span className="shrink-0 text-lg font-bold tabular-nums text-warning-400">
                    {formatPrice(missingKopeks)}
                  </span>
                </div>
              )}
            </BentoCard>
          )}

          {payError?.code === 'period_unavailable' && (
            <p className="text-sm text-error-400">
              {t('simple.sponsored.errors.periodUnavailable')}
            </p>
          )}
          {payError?.code === 'unknown' && (
            <p className="text-sm text-error-400">{t('common.error')}</p>
          )}

          {selectedOption && (
            <>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={payMutation.isPending}
                onClick={() =>
                  hasEnoughBalance ? payMutation.mutate(selectedOption.period_days) : handleTopUp()
                }
              >
                {hasEnoughBalance
                  ? t('simple.sponsored.payButton', { price: formatPrice(totalKopeks) })
                  : t('simple.sponsored.topUpAndPayButton', {
                      price: formatPrice(missingKopeks),
                    })}
              </Button>
              <p className="text-xs text-dark-500">{t('simple.sponsored.payHint')}</p>
            </>
          )}
        </>
      )}
    </SimpleScreen>
  );
}
