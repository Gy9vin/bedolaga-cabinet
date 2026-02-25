import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getTrafficZone } from '../../utils/trafficZone';

interface TrafficProgressBarProps {
  usedGb: number;
  limitGb: number;
  percent: number;
  isUnlimited: boolean;
  showScale?: boolean;
  showThresholds?: boolean;
  compact?: boolean;
}

const THRESHOLDS = [50, 75, 90];

export default function TrafficProgressBar({
  limitGb,
  percent,
  isUnlimited,
  showScale = false,
  showThresholds = false,
  compact = false,
}: TrafficProgressBarProps) {
  const { t } = useTranslation();
  const zone = useMemo(() => getTrafficZone(percent), [percent]);
  const clampedPercent = Math.min(percent, 100);
  const barHeight = compact ? 'h-2' : 'h-3';

  if (isUnlimited) {
    return (
      <div className="relative" role="progressbar" aria-label={t('dashboard.unlimited')}>
        <div className={`${barHeight} w-full overflow-hidden rounded-full bg-dark-800`}>
          <div
            className="h-full w-full animate-unlimited-flow rounded-full"
            style={{
              background:
                'linear-gradient(90deg, rgb(var(--color-accent-400)), rgb(var(--color-accent-600)), rgb(var(--color-accent-400)))',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
        {!compact && (
          <div className="absolute -right-1 top-1/2 -translate-y-1/2" aria-hidden="true">
            <div className="h-2.5 w-2.5 animate-unlimited-pulse rounded-full bg-accent-400" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="relative"
      role="progressbar"
      aria-valuenow={Math.round(clampedPercent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${t('subscription.traffic')}: ${clampedPercent.toFixed(1)}%`}
    >
      {/* Track with zone tint backgrounds */}
      <div className={`relative ${barHeight} w-full overflow-hidden rounded-full bg-dark-800`}>
        {/* Zone tint backgrounds */}
        {showThresholds && (
          <>
            <div
              className="absolute inset-y-0 left-1/2 opacity-[0.06]"
              style={{
                right: '25%',
                background: 'rgb(var(--color-warning-500))',
              }}
            />
            <div
              className="absolute inset-y-0 opacity-[0.06]"
              style={{
                left: '75%',
                right: '10%',
                background: 'rgb(var(--color-warning-600))',
              }}
            />
            <div
              className="absolute inset-y-0 right-0 opacity-[0.06]"
              style={{
                left: '90%',
                background: 'rgb(var(--color-error-500))',
              }}
            />
          </>
        )}

        {/* Fill bar */}
        <div
          className="relative h-full rounded-full transition-all duration-700 ease-smooth"
          style={{
            width: `${clampedPercent}%`,
            background: `linear-gradient(90deg, ${zone.gradientFrom}, ${zone.gradientTo})`,
          }}
        >
          {/* Shimmer overlay */}
          <div className="absolute inset-0 overflow-hidden rounded-full" aria-hidden="true">
            <div
              className="absolute inset-y-0 w-1/2 animate-traffic-shimmer"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
              }}
            />
          </div>
        </div>

        {/* Glow dot at fill edge */}
        {clampedPercent > 2 && !compact && (
          <div
            className="absolute top-1/2 transition-all duration-700"
            style={{ left: `${clampedPercent}%`, transform: 'translate(-50%, -50%)' }}
            aria-hidden="true"
          >
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: zone.gradientTo,
                boxShadow: `0 0 8px ${zone.glowColor}`,
              }}
            />
          </div>
        )}

        {/* Threshold marker lines */}
        {showThresholds &&
          THRESHOLDS.map((threshold) => (
            <div
              key={threshold}
              className="absolute inset-y-0 w-px bg-dark-500/40"
              style={{ left: `${threshold}%` }}
              aria-hidden="true"
            />
          ))}
      </div>

      {/* Scale labels */}
      {showScale && limitGb > 0 && (
        <div
          className="mt-1.5 flex justify-between font-mono text-2xs text-dark-500"
          aria-hidden="true"
        >
          <span>0</span>
          <span>{(limitGb * 0.25).toFixed(0)}</span>
          <span>{(limitGb * 0.5).toFixed(0)}</span>
          <span>{(limitGb * 0.75).toFixed(0)}</span>
          <span>
            {limitGb} {t('common.units.gb')}
          </span>
        </div>
      )}
    </div>
  );
}
