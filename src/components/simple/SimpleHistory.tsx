import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import SimpleGroup from './SimpleGroup';
import SimpleRow from './SimpleRow';
import { BentoCard } from '@/components/ui/BentoCard';
import { subscriptionApi } from '../../api/subscription';
import { formatPrice, formatLongDate, formatPeriodDays } from '../../utils/format';
import type { SubscriptionTimelineEvent } from '../../types/timeline';

/**
 * История подписки простого режима: сводка сверху (с какой даты клиент,
 * сколько всего оплачено, сколько дней с подпиской) и лента событий.
 *
 * Раньше лента переиспользовала общий `SubscriptionTimeline` — у него свой
 * визуальный язык расширенного режима (иконки в кружках, вертикальная
 * «рельса», карточка на каждое событие), который не похож на остальные
 * экраны простого режима и выбивался из макета (находка 1). Здесь — обычный
 * список в `SimpleGroup`/`SimpleRow`, как везде в простом режиме.
 * `SubscriptionTimeline` не трогаем — он остаётся для расширенного режима.
 */
export default function SimpleHistory() {
  const { t } = useTranslation();

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
          <SummaryLine
            title={t('simple.history.since')}
            value={formatLongDate(since, { year: true })}
          />
          <SummaryLine title={t('simple.history.totalPaid')} value={formatPrice(totalPaidKopeks)} />
          <SummaryLine title={t('simple.history.daysWithSubscription')} value={String(daysSince)} />
        </BentoCard>
      )}

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
          {t('simple.history.allEvents')}
        </span>
        {events.length > 0 ? (
          <SimpleGroup className="mt-2">
            {events.map((event) => (
              <EventRow key={event.index} event={event} />
            ))}
          </SimpleGroup>
        ) : (
          <p className="mt-2 text-sm text-dark-50/40">{t('timeline.empty')}</p>
        )}
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

// Заголовок и статусная фраза различаются по типу события — тарифа в
// событии нет (см. SubscriptionTimeline), поэтому заголовок собирается из
// типа события и длительности периода, а не из названия тарифа.
const EVENT_TITLE_KEY: Record<SubscriptionTimelineEvent['event_type'], string> = {
  purchase: 'simple.history.eventTitlePurchase',
  renewal: 'simple.history.eventTitleRenewal',
  activation: 'simple.history.eventTitleActivation',
};

const EVENT_STATUS_KEY: Record<SubscriptionTimelineEvent['event_type'], string> = {
  purchase: 'simple.history.activeUntilPast',
  renewal: 'simple.history.renewedUntil',
  activation: 'simple.history.trialUntil',
};

function EventRow({ event }: { event: SubscriptionTimelineEvent }) {
  const { t } = useTranslation();

  const period = formatPeriodDays(event.period_days ?? 0, t);
  const title = t(EVENT_TITLE_KEY[event.event_type], { period });
  const status = t(EVENT_STATUS_KEY[event.event_type], {
    date: formatLongDate(event.new_end),
  });

  // Перерыв и перенесённый остаток взаимоисключающие (см. SubscriptionTimeline) —
  // показываем максимум одну дополнительную строку под датой.
  const note = event.downtime_seconds
    ? {
        text: t('simple.history.downtimeNote', {
          dur: t('common.period.days', { count: Math.round(event.downtime_seconds / 86400) }),
        }),
        className: 'text-warning-400',
      }
    : event.carried_seconds
      ? {
          text: t('simple.history.carriedNote', {
            dur: t('common.period.days', { count: Math.round(event.carried_seconds / 86400) }),
          }),
          className: 'text-accent-400',
        }
      : null;

  const subtitle = (
    <>
      <span className="block">
        {formatLongDate(event.date)} · {status}
      </span>
      {note && <span className={`mt-0.5 block font-medium ${note.className}`}>{note.text}</span>}
    </>
  );

  return (
    <SimpleRow
      title={title}
      subtitle={subtitle}
      value={event.amount_kopeks ? formatPrice(event.amount_kopeks) : t('timeline.free')}
    />
  );
}
