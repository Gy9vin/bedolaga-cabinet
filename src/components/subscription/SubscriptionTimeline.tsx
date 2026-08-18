import { useTranslation } from 'react-i18next';
import type { SubscriptionTimelineEvent } from '../../types/timeline';
import { humanizeDuration } from '../../utils/subscriptionTimeline';
import { formatPrice, formatPeriodDays } from '../../utils/format';

const fmtDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const ICON: Record<string, string> = { purchase: '💳', renewal: '🔄', activation: '🎁' };

export function SubscriptionTimeline({
  events,
  since,
  isDark = true,
  showAmount = false,
  showPeriodInTitle = false,
}: {
  events: SubscriptionTimelineEvent[];
  since: string | null;
  isDark?: boolean;
  /** Цена события справа в строке (находка 8, используется в простом режиме). */
  showAmount?: boolean;
  /**
   * Необязательный пропс вместо своей отрисовки простого режима (находка 8):
   * компонент общий с расширенным режимом, там заголовок не трогаем.
   * Тарифа в событии нет — добавляем в заголовок хотя бы период
   * («Продление · 3 месяца»), как просит бриф, когда план недоступен.
   */
  showPeriodInTitle?: boolean;
}) {
  const { t } = useTranslation();
  if (!events.length) return <p className="text-sm text-dark-50/40">{t('timeline.empty')}</p>;
  const cardCls = isDark
    ? 'border-dark-700/60 bg-dark-800/40'
    : 'border-champagne-300/60 bg-champagne-200/40';
  return (
    <div>
      <ol className="space-y-2.5">
        {events.map((ev, i) => (
          <li key={ev.index} className="flex gap-3">
            {/* rail: dot + connecting line */}
            <div className="flex flex-col items-center">
              <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dark-700 bg-dark-800 text-sm">
                {ICON[ev.event_type] ?? '•'}
              </div>
              {i < events.length - 1 && <div className="mt-1 w-px flex-1 bg-dark-700/70" />}
            </div>
            {/* content card */}
            <div className={`mb-1 flex-1 rounded-xl border p-3 ${cardCls}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-dark-50">
                  {showPeriodInTitle && ev.period_days
                    ? `${t(`timeline.kind.${ev.event_type}`)} · ${formatPeriodDays(ev.period_days, t)}`
                    : t(`timeline.kind.${ev.event_type}`)}
                </span>
                <span className="text-xs text-dark-50/45">{fmtDate(ev.date)}</span>
                <div className="ml-auto flex items-center gap-2">
                  {showAmount && (
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        ev.amount_kopeks ? 'text-dark-50' : 'text-dark-50/40'
                      }`}
                    >
                      {ev.amount_kopeks ? formatPrice(ev.amount_kopeks) : t('timeline.free')}
                    </span>
                  )}
                  <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-xs font-medium text-accent-400">
                    +{ev.period_days ?? 0}&nbsp;{t('timeline.daysShort')}
                  </span>
                </div>
              </div>

              {ev.downtime_seconds ? (
                <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                  ⚠️&nbsp;
                  {t('timeline.downtime', {
                    prevEnd: fmtDate(ev.prev_end),
                    dur: humanizeDuration(ev.downtime_seconds, t),
                  })}
                </div>
              ) : ev.carried_seconds ? (
                <div className="mt-2 rounded-lg border border-success-500/30 bg-success-500/10 px-3 py-2 text-xs leading-relaxed text-success-400">
                  ✅&nbsp;{t('timeline.carried', { dur: humanizeDuration(ev.carried_seconds, t) })}
                </div>
              ) : null}

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-dark-50/45">🟢&nbsp;{t('timeline.worksUntil')}</span>
                <span className="font-semibold text-dark-50">{fmtDate(ev.new_end)}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {since && (
        <p className="mt-3 text-[11px] text-dark-50/30">
          {t('timeline.since', { date: fmtDate(since) })}
        </p>
      )}
    </div>
  );
}
