import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@/components/icons';

interface SimpleRowProps {
  title: string;
  /** Обычно строка; ReactNode нужен истории подписки — там вторая строка
   * подписи подсвечивается цветом (перенос остатка / перерыв, находка 1). */
  subtitle?: ReactNode;
  value?: ReactNode;
  /** Задан — строка становится кнопкой и доступна с клавиатуры. */
  onClick?: () => void;
  chevron?: boolean;
  danger?: boolean;
}

/**
 * Строка списка простого режима.
 *
 * Строка без обработчика остаётся обычным блоком: превращать её в кнопку
 * «на всякий случай» значит обещать нажатие, которого не будет, и ломать
 * навигацию с клавиатуры.
 */
export default function SimpleRow({
  title,
  subtitle,
  value,
  onClick,
  chevron,
  danger,
}: SimpleRowProps) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className={`font-medium ${danger ? 'text-error-400' : 'text-dark-100'}`}>{title}</p>
        {subtitle && <p className="mt-0.5 text-sm text-dark-400">{subtitle}</p>}
      </div>
      {value !== undefined && (
        <span className="shrink-0 font-semibold tabular-nums text-dark-50">{value}</span>
      )}
      {chevron && <ChevronRightIcon className="size-4 shrink-0 text-dark-50/30" />}
    </>
  );

  const className = 'flex w-full items-center gap-3 py-3 text-left';

  if (!onClick) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
