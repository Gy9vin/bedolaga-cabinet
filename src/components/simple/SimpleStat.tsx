import type { ReactNode } from 'react';

interface SimpleStatProps {
  label: string;
  value: ReactNode;
  sub?: string;
}

/** Плитка показателя: подпись сверху мелким, значение крупным. */
export default function SimpleStat({ label, value, sub }: SimpleStatProps) {
  return (
    <div className="rounded-2xl border border-dark-700/40 bg-dark-900/70 p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-dark-50">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-dark-400">{sub}</p>}
    </div>
  );
}
