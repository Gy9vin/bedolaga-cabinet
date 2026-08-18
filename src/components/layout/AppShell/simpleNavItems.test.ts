import { describe, expect, it } from 'vitest';
import { SIMPLE_NAV_PATHS, filterNavForSimpleMode } from './simpleNavItems';

const ALL = [
  { path: '/' },
  { path: '/subscriptions' },
  { path: '/balance' },
  { path: '/referral' },
  { path: '/support' },
  { path: '/contests' },
  { path: '/polls' },
  { path: '/wheel' },
  { path: '/gift' },
  { path: '/info' },
  { path: '/profile' },
];

describe('навигация простого режима', () => {
  it('оставляет ровно четыре раздела', () => {
    expect(filterNavForSimpleMode(ALL).map((i) => i.path)).toEqual([
      '/',
      '/subscriptions',
      '/referral',
      '/profile',
    ]);
  });

  it('сохраняет порядок исходного списка, а не порядок путей', () => {
    const shuffled = [{ path: '/profile' }, { path: '/' }, { path: '/wheel' }];
    expect(filterNavForSimpleMode(shuffled).map((i) => i.path)).toEqual(['/profile', '/']);
  });

  it('не падает на пустом списке', () => {
    expect(filterNavForSimpleMode([])).toEqual([]);
  });

  it('не выдумывает разделы, которых нет во входном списке', () => {
    expect(filterNavForSimpleMode([{ path: '/' }]).map((i) => i.path)).toEqual(['/']);
  });

  it('баланс в простом режиме не отдельный раздел', () => {
    expect(SIMPLE_NAV_PATHS).not.toContain('/balance');
  });

  it('не путает /subscriptions с вложенным маршрутом', () => {
    expect(filterNavForSimpleMode([{ path: '/subscriptions/42' }])).toEqual([]);
  });
});
