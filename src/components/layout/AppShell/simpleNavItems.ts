// Четыре раздела простого режима. Каждый соответствует задаче человека, а не
// разделу системы: посмотреть подписку и подключиться, купить или продлить,
// пригласить и вывести, управлять входом.
//
// Баланса в списке нет намеренно: в простом режиме деньги вносятся в момент
// покупки, а не «про запас», поэтому пополнение открывается строкой с главной.
export const SIMPLE_NAV_PATHS = ['/', '/subscriptions', '/referral', '/profile'] as const;

const SIMPLE_NAV_SET: ReadonlySet<string> = new Set(SIMPLE_NAV_PATHS);

// Сравнение строгое, по полному пути. Префиксное совпадение отобрало бы и
// вложенные маршруты вроде /subscriptions/42, которых в меню быть не должно.
export function filterNavForSimpleMode<T extends { path: string }>(items: T[]): T[] {
  return items.filter((item) => SIMPLE_NAV_SET.has(item.path));
}
