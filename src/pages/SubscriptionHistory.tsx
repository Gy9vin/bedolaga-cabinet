import SimpleHistory from '../components/simple/SimpleHistory';

/**
 * Страница «История подписки» — существует только для простого режима
 * (в полном кабинете история уже встроена в /subscriptions/:id). Отдельная
 * тонкая страница нужна лишь чтобы завести ленивый маршрут /subscription/history.
 */
export default function SubscriptionHistory() {
  return <SimpleHistory />;
}
