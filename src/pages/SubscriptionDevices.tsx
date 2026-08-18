import SimpleDevices from '../components/simple/SimpleDevices';

/**
 * Страница «Устройства» — существует только для простого режима (полный
 * кабинет управляет устройствами внутри /subscriptions/:id). Тонкая
 * страница нужна лишь чтобы завести ленивый маршрут /subscription/devices.
 */
export default function SubscriptionDevices() {
  return <SimpleDevices />;
}
