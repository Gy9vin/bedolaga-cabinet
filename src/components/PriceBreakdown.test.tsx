// @vitest-environment jsdom
/**
 * PriceBreakdown — чисто презентационный компонент: рисует строки
 * price_lines с бэкенда (label/amount/hint) и «Итого», без собственной
 * арифметики. При пустом/отсутствующем массиве не рисует ничего, чтобы
 * экран не ломался для ответов без расшифровки.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n';
import PriceBreakdown from './PriceBreakdown';
import type { PriceLine } from '../types';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
});

describe('PriceBreakdown', () => {
  it('рисует строки с суммами и подсказку (hint) под строкой', () => {
    const lines: PriceLine[] = [
      { label: 'Тариф', amount_kopeks: 50000, hint: null },
      {
        label: 'Доп. устройства (2 шт.)',
        amount_kopeks: 20000,
        hint: '100,00 ₽ в месяц за устройство × 2 шт.',
      },
    ];

    renderWithI18n(<PriceBreakdown lines={lines} totalKopeks={70000} />);

    expect(screen.getByText('Тариф')).toBeTruthy();
    expect(screen.getByText('Доп. устройства (2 шт.)')).toBeTruthy();
    expect(screen.getByText('100,00 ₽ в месяц за устройство × 2 шт.')).toBeTruthy();
    // "Итого"/"Total" label — locale in the test environment isn't pinned,
    // so match either translation like the rest of the suite does.
    expect(screen.getByText(/Итого|Total/i)).toBeTruthy();
    // Final total amount (700 rubles/dollars) is shown once.
    expect(screen.getByText(/700/)).toBeTruthy();
  });

  it('рисует отрицательную сумму (скидку) со знаком минус', () => {
    const lines: PriceLine[] = [
      { label: 'Период', amount_kopeks: 100000, hint: null },
      { label: 'Скидка по промокоду', amount_kopeks: -10000, hint: null },
    ];

    renderWithI18n(<PriceBreakdown lines={lines} totalKopeks={90000} />);

    expect(screen.getByText('Скидка по промокоду')).toBeTruthy();
    expect(screen.getByText(/-.*100/)).toBeTruthy();
  });

  it('при пустом массиве ничего не рисует', () => {
    const { container } = renderWithI18n(<PriceBreakdown lines={[]} totalKopeks={50000} />);
    expect(container.firstChild).toBeNull();
  });

  it('при отсутствующем массиве (undefined) ничего не рисует', () => {
    const { container } = renderWithI18n(<PriceBreakdown lines={undefined} totalKopeks={50000} />);
    expect(container.firstChild).toBeNull();
  });
});
