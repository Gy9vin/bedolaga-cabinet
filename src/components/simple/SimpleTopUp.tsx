import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import { Button } from '@/components/primitives/Button/Button';
import { BentoCard } from '@/components/ui/BentoCard';
import { usePlatform } from '@/platform';
import { openPaymentUrl } from '../../utils/openPaymentUrl';
import { balanceApi } from '../../api/balance';
import { formatPrice } from '../../utils/format';

/**
 * Экран «Пополнение баланса» простого режима: сумма и способ оплаты на
 * одном экране, без отдельного шага выбора способа. Способ, чей минимум
 * не проходит по введённой сумме, недоступен для выбора сразу — иначе
 * человек узнаёт об этом только после перехода к провайдеру (в частности,
 * так проявлялся баг с платным триалом за 10 ₽: сумма ниже минимума
 * ЛЮБОГО способа).
 */
export default function SimpleTopUp() {
  const { t } = useTranslation();
  const { platform, openLink } = usePlatform();

  const [amountRub, setAmountRub] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: balanceApi.getBalance,
  });

  const { data: presetsData } = useQuery({
    queryKey: ['topup-presets'],
    queryFn: balanceApi.getTopupPresets,
  });
  const presets = presetsData?.presets ?? [];

  const { data: methods } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: balanceApi.getPaymentMethods,
  });
  const availableMethods = (methods ?? []).filter((m) => m.is_available);

  const amountKopeks = useMemo(() => {
    const parsed = Number.parseFloat(amountRub.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
  }, [amountRub]);

  const isMethodDisabled = (minAmountKopeks: number) =>
    amountKopeks > 0 && minAmountKopeks > amountKopeks;

  const effectiveMethodId =
    selectedMethodId &&
    !isMethodDisabled(
      availableMethods.find((m) => m.id === selectedMethodId)?.min_amount_kopeks ?? 0,
    )
      ? selectedMethodId
      : (availableMethods.find((m) => !isMethodDisabled(m.min_amount_kopeks))?.id ?? null);

  const balanceAfter = (balance?.balance_kopeks ?? 0) + amountKopeks;

  const topUpMutation = useMutation({
    mutationFn: () => {
      if (!effectiveMethodId) throw new Error('No payment method selected');
      return balanceApi.createTopUp(amountKopeks, effectiveMethodId);
    },
    onSuccess: (data) => {
      const redirectUrl = data.payment_url;
      if (redirectUrl) {
        setPaymentUrl(redirectUrl);
        openPaymentUrl(redirectUrl, platform, openLink);
      }
    },
  });

  const canSubmit = amountKopeks > 0 && !!effectiveMethodId && !topUpMutation.isPending;

  return (
    <SimpleScreen title={t('simple.topUp.title')}>
      <BentoCard>
        <SumRow
          title={t('simple.topUp.currentBalance')}
          value={formatPrice(balance?.balance_kopeks ?? 0)}
        />
        <SumRow
          title={t('simple.topUp.balanceAfter')}
          value={formatPrice(balanceAfter)}
          tone={amountKopeks > 0 ? 'success' : undefined}
        />
      </BentoCard>

      <div>
        <label
          htmlFor="simple-topup-amount"
          className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40"
        >
          {t('simple.topUp.amountLabel')}
        </label>
        <div className="mt-2 flex items-center justify-center gap-1 rounded-2xl border border-accent-500 px-4 py-4">
          <input
            id="simple-topup-amount"
            type="number"
            inputMode="decimal"
            min={0}
            value={amountRub}
            onChange={(e) => setAmountRub(e.target.value)}
            placeholder="0"
            className="w-full min-w-0 bg-transparent text-center text-3xl font-bold tabular-nums text-dark-50 placeholder:text-dark-600 focus:outline-none"
          />
          <span className="shrink-0 text-2xl font-bold text-dark-400">₽</span>
        </div>
      </div>

      {presets.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.topUp.presetsLabel')}
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {presets.map((preset) => {
              const rub = preset.amount_kopeks / 100;
              const isSelected = amountKopeks === preset.amount_kopeks;
              return (
                <button
                  key={preset.amount_kopeks}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setAmountRub(String(rub))}
                  className={`rounded-xl border px-3.5 py-2.5 text-left text-sm font-semibold tabular-nums transition-colors ${
                    isSelected
                      ? 'border-accent-500/60 bg-accent-500/10 text-accent-400'
                      : 'border-dark-700/40 bg-dark-900/70 text-dark-100'
                  }`}
                >
                  {formatPrice(preset.amount_kopeks)}
                  <small className="mt-0.5 block text-[10.5px] font-medium text-dark-400">
                    {t('simple.topUp.presetDays', { count: preset.label_days })}
                  </small>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-dark-500">{t('simple.topUp.presetsHint')}</p>
        </div>
      )}

      {availableMethods.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.topUp.methodLabel')}
          </span>
          <div className="mt-2 space-y-2">
            {availableMethods.map((method) => {
              const disabled = isMethodDisabled(method.min_amount_kopeks);
              const isSelected = !disabled && method.id === effectiveMethodId;
              return (
                <button
                  key={method.id}
                  type="button"
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={() => setSelectedMethodId(method.id)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected
                      ? 'border-accent-500/60 bg-accent-500/10'
                      : 'border-dark-700/40 bg-dark-900/70'
                  }`}
                >
                  <span className="font-medium text-dark-100">{method.name}</span>
                  {method.min_amount_kopeks > 0 && (
                    <span className="text-xs text-dark-400">
                      {t('simple.topUp.methodMin', {
                        amount: formatPrice(method.min_amount_kopeks),
                      })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canSubmit}
        loading={topUpMutation.isPending}
        onClick={() => topUpMutation.mutate()}
      >
        {t('simple.topUp.submitButton', { amount: formatPrice(amountKopeks) })}
      </Button>
      <p className="text-xs text-dark-500">{t('simple.topUp.methodHint')}</p>

      {paymentUrl && (
        <p className="text-center text-xs text-dark-500">{t('simple.topUp.paymentReady')}</p>
      )}
    </SimpleScreen>
  );
}

function SumRow({ title, value, tone }: { title: string; value: string; tone?: 'success' }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="font-medium text-dark-100">{title}</span>
      <span
        className={`shrink-0 font-semibold tabular-nums ${
          tone === 'success' ? 'text-success-400' : 'text-dark-50'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
