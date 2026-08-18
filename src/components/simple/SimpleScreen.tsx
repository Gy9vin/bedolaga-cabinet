import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/components/motion/transitions';

interface SimpleScreenProps {
  /** Заголовок экрана. Не задан — заголовка не будет вовсе, а не пустая строка. */
  title?: string;
  /** Бренд-строка вместо заголовка: так устроена главная в макете. */
  brand?: string;
  /**
   * Плашка «Простой режим» рядом с брендом (находка 8 сверки с макетом).
   * Задаётся отдельно от `brand`, а не выводится автоматически при его
   * наличии — в макете чип стоит только в шапке главной, а не везде, где
   * есть брендовая строка.
   */
  modeChip?: string;
  children: ReactNode;
}

/**
 * Обёртка экрана простого режима: единый вертикальный ритм и одинаковое
 * появление блоков. Без неё каждый экран заводит свои отступы, и они разъезжаются.
 */
export default function SimpleScreen({ title, brand, modeChip, children }: SimpleScreenProps) {
  return (
    <motion.div
      className="flex flex-col gap-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {brand && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dark-50/40">
            {brand}
          </p>
          {modeChip && (
            <span className="shrink-0 rounded-full border border-accent-500/30 bg-accent-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-accent-400">
              {modeChip}
            </span>
          )}
        </div>
      )}
      {title && <h1 className="text-2xl font-bold tracking-tight text-dark-50">{title}</h1>}
      {children}
    </motion.div>
  );
}
