import { Children, type ReactNode } from 'react';

interface SimpleGroupProps {
  children: ReactNode;
  className?: string;
}

/**
 * Карточка-группа простого режима: рамка + скругление, как у BentoCard
 * (токены `border-dark-700/40` / `bg-dark-900/70`), плюс тонкий разделитель
 * между строками — у первой строки его нет, у остальных есть.
 *
 * Без этой обёртки строки лежат плоским списком без рамок и разделов, и
 * разные смысловые блоки экрана визуально сливаются друг с другом — это и
 * есть находка 1 в разборе макета владельцем. В макете строки собраны в
 * `.rows`: контейнер с рамкой и скруглением, `.row` внутри получает
 * `border-top` у всех, кроме первого — реализовано здесь так же явно
 * (не через Tailwind `divide-y`, чтобы разделитель был проверяем в тестах
 * без сборки CSS).
 */
export default function SimpleGroup({ children, className = '' }: SimpleGroupProps) {
  const items = Children.toArray(children);

  return (
    <div
      className={`overflow-hidden rounded-[var(--bento-radius)] border border-dark-700/40 bg-dark-900/70 ${className}`}
    >
      {items.map((child, index) => (
        <div
          key={index}
          data-testid="simple-group-row"
          className={index === 0 ? 'px-3.5' : 'border-t border-dark-800/50 px-3.5'}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
