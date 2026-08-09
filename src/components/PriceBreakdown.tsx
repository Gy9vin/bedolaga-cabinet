import { useTranslation } from 'react-i18next';
import { formatPrice } from '../utils/format';
import type { PriceLine } from '../types';

// ──────────────────────────────────────────────────────────────────
// PriceBreakdown
//
// Renders the "из чего складывается цена" list the backend sends
// alongside subscription renewal / sponsored payment / tariff
// purchase responses (``price_lines``). Purely presentational: no
// arithmetic happens here — every amount and the final total come
// straight from the API.
//
// Renders nothing when there are no lines, so callers can pass the
// field through unconditionally without guarding the screen.
// ──────────────────────────────────────────────────────────────────

export interface PriceBreakdownProps {
  /** Lines as returned by the backend; absent/empty renders nothing. */
  lines: PriceLine[] | null | undefined;
  /** Final total to show under "Итого" — not derived from `lines`. */
  totalKopeks: number;
  className?: string;
}

export default function PriceBreakdown({
  lines,
  totalKopeks,
  className = '',
}: PriceBreakdownProps) {
  const { t } = useTranslation();

  if (!lines || lines.length === 0) {
    return null;
  }

  return (
    <div className={`rounded-xl border border-dark-700/50 bg-dark-800/30 p-4 ${className}`}>
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-dark-500">
        {t('priceBreakdown.title', 'Из чего складывается цена')}
      </div>
      <div className="space-y-2.5">
        {lines.map((line, idx) => {
          const isDiscount = line.amount_kopeks < 0;
          return (
            <div key={idx} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className={isDiscount ? 'text-success-400' : 'text-dark-300'}>
                  {line.label}
                </div>
                {line.hint && <div className="mt-0.5 text-xs text-dark-500">{line.hint}</div>}
              </div>
              <div
                className={`shrink-0 font-medium ${isDiscount ? 'text-success-400' : 'text-dark-200'}`}
              >
                {formatPrice(line.amount_kopeks)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-dark-700/50 pt-3">
        <span className="text-sm font-medium text-dark-100">
          {t('priceBreakdown.total', 'Итого')}
        </span>
        <span className="text-base font-semibold text-dark-100">{formatPrice(totalKopeks)}</span>
      </div>
    </div>
  );
}
