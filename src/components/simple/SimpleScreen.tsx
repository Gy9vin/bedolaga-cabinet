import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { staggerContainer } from '@/components/motion/transitions';

interface SimpleScreenProps {
  /** Заголовок экрана. Не задан — заголовка не будет вовсе, а не пустая строка. */
  title?: string;
  /** Бренд-строка вместо заголовка: так устроена главная в макете. */
  brand?: string;
  children: ReactNode;
}

/**
 * Обёртка экрана простого режима: единый вертикальный ритм и одинаковое
 * появление блоков. Без неё каждый экран заводит свои отступы, и они разъезжаются.
 */
export default function SimpleScreen({ title, brand, children }: SimpleScreenProps) {
  return (
    <motion.div
      className="flex flex-col gap-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {brand && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-dark-50/40">
          {brand}
        </p>
      )}
      {title && <h1 className="text-2xl font-bold tracking-tight text-dark-50">{title}</h1>}
      {children}
    </motion.div>
  );
}
