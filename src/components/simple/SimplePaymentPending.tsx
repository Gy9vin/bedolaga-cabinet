import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import SimpleGroup from './SimpleGroup';
import SimpleRow from './SimpleRow';
import { ClockIcon } from '@/components/icons';
import { formatPrice } from '../../utils/format';

interface SimplePaymentPendingProps {
  /** Сумма пополнения в копейках — единственное реально известное на этом
   * экране число (из данных страницы TopUpResult), поэтому только оно и
   * показано со значением; сколько именно спишется за подписку, отсюда
   * не видно — эту цифру не выдумываем. */
  amountKopeks: number | null;
}

/**
 * Экран «Ждём оплату» простого режима (разрыв 3): человек вернулся из
 * банка, а платёж ещё не подтверждён. Объясняет, что произойдёт дальше, и
 * что экран можно закрыть — включим подписку сами.
 */
export default function SimplePaymentPending({ amountKopeks }: SimplePaymentPendingProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-dark-950 px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-5 rounded-2xl border border-dark-800/50 bg-dark-900/50 p-8"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-500/10">
            <ClockIcon className="h-8 w-8 text-warning-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark-50">{t('simple.paymentPending.title')}</h1>
            <p className="mt-2 text-sm text-dark-400">{t('simple.paymentPending.subtitle')}</p>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.paymentPending.whatNextLabel')}
          </span>
          <SimpleGroup className="mt-2">
            <SimpleRow
              title={t('simple.paymentPending.stepTopUp')}
              value={
                amountKopeks != null && amountKopeks > 0 ? (
                  <span className="text-success-400">+ {formatPrice(amountKopeks)}</span>
                ) : undefined
              }
            />
            {/* Состав и сумму покупки здесь показать нечем: кабинет не хранит
             * прочитываемую корзину (previewPurchase/saveTariffCart только
             * пишут флаг намерения на бэкенде, назад состав не отдают), а
             * TopUpResult знает только сумму самого пополнения. Вместо
             * пустой строки — честная подпись без выдуманных чисел. */}
            <SimpleRow
              title={t('simple.paymentPending.stepCharge')}
              subtitle={t('simple.paymentPending.stepChargeSub')}
            />
            <SimpleRow
              title={t('simple.paymentPending.stepActivate')}
              subtitle={t('simple.paymentPending.stepActivateSub')}
            />
          </SimpleGroup>
        </div>

        <p className="text-center text-xs text-dark-500">{t('simple.paymentPending.hint')}</p>
      </motion.div>
    </div>
  );
}
