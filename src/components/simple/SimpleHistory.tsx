import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import { BentoCard } from '@/components/ui/BentoCard';
import { SubscriptionTimeline } from '../subscription/SubscriptionTimeline';
import { subscriptionApi } from '../../api/subscription';
import { useTheme } from '../../hooks/useTheme';
import { formatPrice, formatShortDate } from '../../utils/format';

/**
 * История подписки простого режима: сводка сверху (с какой даты клиент,
 * сколько всего оплачено, сколько дней с подпиской) и сама лента событий.
 * Лента — готовый SubscriptionTimeline (он уже рисует перерывы и
 * перенесённый остаток), поэтому здесь только оборачиваем его и считаем
 * сводку из тех же events/since, не выдумывая свой источник данных.
 */
export default function SimpleHistory() {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const { data, isLoading } = useQuery({
    queryKey: ['subscription-timeline'],
    queryFn: subscriptionApi.getTimeline,
  });

  const events = data?.events ?? [];
  const since = data?.since ?? null;

  const totalPaidKopeks = useMemo(
    () => events.reduce((sum, ev) => sum + (ev.amount_kopeks ?? 0), 0),
    [events],
  );

  // «Дней с подпиской» — календарные дни от первого события до сегодня.
  // Перерывы (downtime_seconds) внутри этого периода не вычитаем: их видно
  // прямо в ленте событий — это они объясняют дыры в датах, а не сводка.
  const daysSince = useMemo(() => {
    if (!since) return 0;
    const start = new Date(since).getTime();
    if (!Number.isFinite(start)) return 0;
    return Math.max(0, Math.floor((Date.now() - start) / 86_400_000));
  }, [since]);

  if (isLoading) {
    return (
      <SimpleScreen title={t('simple.history.title')}>
        <div className="skeleton h-32 w-full rounded-2xl" />
      </SimpleScreen>
    );
  }

  return (
    <SimpleScreen title={t('simple.history.title')}>
      {since && (
        <BentoCard>
          <SummaryLine title={t('simple.history.since')} value={formatShortDate(since)} />
          <SummaryLine title={t('simple.history.totalPaid')} value={formatPrice(totalPaidKopeks)} />
          <SummaryLine title={t('simple.history.daysWithSubscription')} value={String(daysSince)} />
        </BentoCard>
      )}

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
          {t('simple.history.allEvents')}
        </span>
        <div className="mt-2">
          <SubscriptionTimeline events={events} since={since} isDark={isDark} />
        </div>
      </div>

      <p className="text-xs text-dark-500">{t('simple.history.hint')}</p>
    </SimpleScreen>
  );
}

function SummaryLine({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="font-medium text-dark-100">{title}</span>
      <span className="shrink-0 font-semibold tabular-nums text-dark-50">{value}</span>
    </div>
  );
}
