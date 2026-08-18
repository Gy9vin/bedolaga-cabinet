// @vitest-environment jsdom
/**
 * Примитивы простого режима. Проверяем ровно то, ради чего они заведены:
 * единообразие структуры. Строка без обработчика не должна притворяться
 * кликабельной, а строка с обработчиком — обязана быть доступна с клавиатуры.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../../i18n';
import SimpleScreen from './SimpleScreen';
import SimpleRow from './SimpleRow';
import SimpleStat from './SimpleStat';

function r(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => cleanup());

describe('SimpleScreen', () => {
  it('рисует заголовок и содержимое', () => {
    r(
      <SimpleScreen title="Подписка">
        <p>внутри</p>
      </SimpleScreen>,
    );
    expect(screen.getByText('Подписка')).toBeTruthy();
    expect(screen.getByText('внутри')).toBeTruthy();
  });

  it('без заголовка не рисует пустой заголовок', () => {
    const { container } = r(
      <SimpleScreen>
        <p>внутри</p>
      </SimpleScreen>,
    );
    expect(container.querySelector('h1')).toBeNull();
  });
});

describe('SimpleRow', () => {
  it('строка без обработчика не кликабельна', () => {
    r(<SimpleRow title="Баланс" value="340 ₽" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('строка с обработчиком доступна как кнопка и срабатывает', () => {
    const onClick = vi.fn();
    r(<SimpleRow title="Баланс" onClick={onClick} />);
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('подпись и значение выводятся, когда переданы', () => {
    r(<SimpleRow title="Лимит" subtitle="Добавить место" value="5" />);
    expect(screen.getByText('Лимит')).toBeTruthy();
    expect(screen.getByText('Добавить место')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });
});

describe('SimpleStat', () => {
  it('рисует подпись и значение', () => {
    r(<SimpleStat label="Пришли" value={7} />);
    expect(screen.getByText('Пришли')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });
});
