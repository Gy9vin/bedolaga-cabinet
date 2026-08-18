// @vitest-environment jsdom
/**
 * SimpleGroup — карточка-группа строк простого режима (находка 1 разбора
 * макета). Проверяем структуру, ради которой её завели: рамка на контейнере,
 * разделитель между строками отсутствует у первой и присутствует у
 * последующих.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SimpleGroup from './SimpleGroup';

afterEach(() => cleanup());

describe('SimpleGroup', () => {
  it('рисует рамку и скругление на контейнере', () => {
    const { container } = render(
      <SimpleGroup>
        <p>Раз</p>
      </SimpleGroup>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('border-dark-700/40');
    expect(wrapper.className).toContain('bg-dark-900/70');
    expect(wrapper.className).toContain('rounded-[var(--bento-radius)]');
  });

  it('у первой строки нет верхнего разделителя, у последующих есть', () => {
    render(
      <SimpleGroup>
        <p>Раз</p>
        <p>Два</p>
        <p>Три</p>
      </SimpleGroup>,
    );
    const rows = screen.getAllByTestId('simple-group-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].className).not.toContain('border-t');
    expect(rows[1].className).toContain('border-t');
    expect(rows[1].className).toContain('border-dark-800/50');
    expect(rows[2].className).toContain('border-t');
  });

  it('пропускает свой className дальше в контейнер', () => {
    const { container } = render(
      <SimpleGroup className="mt-4">
        <p>Раз</p>
      </SimpleGroup>,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain('mt-4');
  });
});
