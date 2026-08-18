import SimpleDeviceLimit from '../components/simple/SimpleDeviceLimit';

/**
 * Страница «Лимит устройств» — существует только для простого режима.
 * Тонкая страница нужна лишь чтобы завести ленивый маршрут
 * /subscription/devices/limit.
 */
export default function SubscriptionDeviceLimit() {
  return <SimpleDeviceLimit />;
}
