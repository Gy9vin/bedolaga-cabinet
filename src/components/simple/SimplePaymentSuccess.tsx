import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import SimpleGroup from './SimpleGroup';
import SimpleRow from './SimpleRow';
import { Button } from '@/components/primitives/Button/Button';
import { AnimatedCheckmark } from '@/components/ui/AnimatedCheckmark';
import { useSubscriptionConnection } from '@/hooks/useSubscriptionConnection';
import { subscriptionApi } from '../../api/subscription';
import { balanceApi } from '../../api/balance';
import { formatPrice, formatShortDate } from '../../utils/format';

interface SimplePaymentSuccessProps {
  /** Сумма пополнения в копейках — реальное число со страницы TopUpResult. */
  amountKopeks: number | null;
  /** Название способа оплаты, если оно известно странице (для строки «Пополнение»). */
  methodName?: string | null;
  /** Момент оплаты (ISO) — для времени в той же строке. Не выдумываем время,
   * если бэкенд его не прислал. */
  paidAt?: string | null;
}

function formatTimeOfDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Экран «Готово» простого режима (разрыв 4): успешное пополнение, которое
 * (в связке с разрывом 2) включило подписку само. Главное действие —
 * подключение устройства, а не список подписок: человек уже там, куда шёл.
 *
 * Сколько именно списалось за подписку, отсюда не видно (нет читающего
 * корзину эндпоинта) — эту цифру не выдумываем, показываем только то, что
 * реально известно странице: сумму пополнения и текущий остаток баланса.
 */
export default function SimplePaymentSuccess({
  amountKopeks,
  methodName,
  paidAt,
}: SimplePaymentSuccessProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: subscriptionResponse } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => subscriptionApi.getSubscription(),
    retry: false,
  });
  const subscription = subscriptionResponse?.subscription ?? null;
  const hasSubscription =
    !!subscription && !subscription.is_expired && subscription.status !== 'disabled';

  const { handleCopyLink, handleShowQr } = useSubscriptionConnection(hasSubscription);

  const { data: balanceData } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
  });

  const topUpSubtitle =
    [methodName, formatTimeOfDay(paidAt)].filter(Boolean).join(' · ') || undefined;
  // Сумму списания за подписку показать нечем (см. комментарий класса выше) —
  // но время самой оплаты известно (paidAt), поэтому в подпись «Автоматически»
  // добавляем хотя бы его, как в мокапе («Автоматически · 20:14»).
  const chargeSubtitle =
    [t('simple.paymentSuccess.rowChargeSub'), formatTimeOfDay(paidAt)]
      .filter(Boolean)
      .join(' · ') || undefined;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-dark-950 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-5 rounded-2xl border border-dark-800/50 bg-dark-900/50 p-8"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <AnimatedCheckmark />
          {hasSubscription && subscription ? (
            <div>
              <h1 className="text-xl font-bold text-dark-50">
                {t('simple.paymentSuccess.statusTitle')}
              </h1>
              {/* Мокап добавляет сюда купленный период («3 месяца»), но у
               * Subscription нет поля с длительностью именно этой покупки —
               * только start_date/end_date всей подписки, а их разница
               * включает и более ранние продления. Читающего корзину
               * эндпоинта тоже нет (см. комментарий класса выше), поэтому
               * период не выдумываем и оставляем тариф/устройства/дату. */}
              <p className="mt-1 text-sm text-dark-400">
                {t('simple.subscription.tariffLabel', { name: subscription.tariff_name || '—' })}
                {' · '}
                {t('simple.subscription.devicesCount', { count: subscription.device_limit })}
                {' · '}
                {t('simple.paymentSuccess.untilLower', {
                  date: formatShortDate(subscription.end_date),
                })}
              </p>
            </div>
          ) : (
            <h1 className="text-xl font-bold text-dark-50">
              {t('simple.paymentSuccess.statusTitleNoSubscription')}
            </h1>
          )}
        </div>

        {hasSubscription && (
          <>
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
          </>
        )}

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.paymentSuccess.whatHappenedLabel')}
          </span>
          <SimpleGroup className="mt-2">
            {amountKopeks != null && amountKopeks > 0 && (
              <SimpleRow
                title={t('simple.paymentSuccess.rowTopUp')}
                subtitle={topUpSubtitle}
                value={<span className="text-success-400">+ {formatPrice(amountKopeks)}</span>}
              />
            )}
            {hasSubscription && (
              <SimpleRow title={t('simple.paymentSuccess.rowCharge')} subtitle={chargeSubtitle} />
            )}
            <SimpleRow
              title={t('simple.paymentSuccess.rowBalanceLeft')}
              value={formatPrice(balanceData?.balance_kopeks ?? 0)}
            />
          </SimpleGroup>
        </div>

        <p className="text-center text-xs text-dark-500">{t('simple.paymentSuccess.hint')}</p>
      </motion.div>
    </div>
  );
}
