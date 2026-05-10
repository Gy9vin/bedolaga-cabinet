import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminExpiryFallbackApi } from '../api/adminExpiryFallback';
import { useDestructiveConfirm } from '@/platform';
import { useNotify } from '@/platform/hooks/useNotify';

const BackIcon = () => (
  <svg
    className="h-5 w-5 text-dark-400"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'default' | 'warning' | 'danger' | 'success';
}

function StatCard({ label, value, hint, accent = 'default' }: StatCardProps) {
  const accentClass =
    accent === 'warning'
      ? 'border-warning-500/30 bg-warning-500/5'
      : accent === 'danger'
        ? 'border-error-500/30 bg-error-500/5'
        : accent === 'success'
          ? 'border-success-500/30 bg-success-500/5'
          : 'border-dark-700 bg-dark-800/50';

  const valueClass =
    accent === 'warning'
      ? 'text-warning-400'
      : accent === 'danger'
        ? 'text-error-400'
        : accent === 'success'
          ? 'text-success-400'
          : 'text-dark-100';

  return (
    <div className={`rounded-xl border p-4 ${accentClass}`}>
      <div className="text-xs uppercase tracking-wide text-dark-400">{label}</div>
      <div className={`mt-2 text-2xl font-bold ${valueClass}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-dark-500">{hint}</div>}
    </div>
  );
}

export default function AdminExpiryFallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useNotify();
  const confirmDestructive = useDestructiveConfirm();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-expiry-fallback-stats'],
    queryFn: adminExpiryFallbackApi.getStats,
    refetchInterval: 30000,
  });

  const reconcileMutation = useMutation({
    mutationFn: adminExpiryFallbackApi.reconcile,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-expiry-fallback-stats'] });
      const lines = Object.entries(res.stats || {})
        .filter(([, v]) => typeof v === 'number' && (v as number) > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      notify.success(lines ? `Reconcile завершён: ${lines}` : 'Reconcile прошёл (изменений нет)');
    },
    onError: () => notify.error('Не удалось запустить reconcile'),
  });

  const restoreAllMutation = useMutation({
    mutationFn: adminExpiryFallbackApi.restoreAll,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-expiry-fallback-stats'] });
      notify.success(
        `Возвращено: ${res.restored} из ${res.total}${res.failed ? `, ошибок: ${res.failed}` : ''}`,
      );
    },
    onError: () => notify.error('Не удалось вернуть всех'),
  });

  const cleanupMutation = useMutation({
    mutationFn: adminExpiryFallbackApi.cleanupOldExpired,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-expiry-fallback-stats'] });
      const parts = [`Удалено: ${res.deleted} из ${res.total_candidates}`];
      if (res.skipped_with_balance) parts.push(`пропущено с балансом: ${res.skipped_with_balance}`);
      if (res.skipped_pending_purchase) parts.push(`pending: ${res.skipped_pending_purchase}`);
      notify.success(parts.join(', '));
    },
    onError: () => notify.error('Не удалось выполнить очистку'),
  });

  const scanAndMoveMutation = useMutation({
    mutationFn: adminExpiryFallbackApi.scanAndMove,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin-expiry-fallback-stats'] });
      if (!res.success) {
        notify.error(res.error || 'Не удалось запустить scan-and-move');
        return;
      }
      const parts = [`Просканировано: ${res.scanned}`, `переведено: ${res.moved}`];
      if (res.skipped_dev_mode) parts.push(`DEV-skip: ${res.skipped_dev_mode}`);
      if (res.skipped_no_remnawave_uuid) parts.push(`без UUID: ${res.skipped_no_remnawave_uuid}`);
      if (res.failed) parts.push(`ошибок: ${res.failed}`);
      notify.success(parts.join(', '));
    },
    onError: () => notify.error('Не удалось выполнить scan-and-move'),
  });

  const handleReconcile = async () => {
    const ok = await confirmDestructive(
      'Принудительно прогнать reconcile прямо сейчас? Не ждать 15 мин.',
      'Запустить',
      'Reconcile fallback',
    );
    if (ok) reconcileMutation.mutate();
  };

  const handleCleanup = async () => {
    const ok = await confirmDestructive(
      'Удалить юзеров со status=EXPIRED старше INACTIVE_USER_DELETE_MONTHS месяцев ' +
        '(только с нулевым балансом и без pending покупок). Период задаётся в .env. ' +
        'Удаление необратимо!',
      'Удалить',
      'Очистка старых EXPIRED',
    );
    if (ok) cleanupMutation.mutate();
  };

  const handleRestoreAll = async () => {
    if (!stats || stats.total_in_fallback === 0) {
      notify.warning('Сейчас никого нет в fallback');
      return;
    }
    const first = await confirmDestructive(
      `Вернуть ВСЕХ ${stats.total_in_fallback} юзеров из fallback в исходные сквады? ` +
        'Это аварийная операция — обычно возврат происходит автоматически при продлении.',
      'Продолжить',
      'Возврат всех из fallback',
    );
    if (!first) return;
    const second = await confirmDestructive(
      'Точно? После возврата юзеры с истёкшей подпиской снова окажутся без VPN.',
      'Да, вернуть всех',
      'Подтверждение',
    );
    if (second) restoreAllMutation.mutate();
  };

  const handleScanAndMove = async () => {
    if (!stats?.enabled) {
      notify.warning('Система fallback выключена (EXPIRY_FALLBACK_ENABLED=false)');
      return;
    }
    if (!stats.fallback_squad_uuid) {
      notify.warning('Не задан EXPIRY_FALLBACK_SQUAD_UUID');
      return;
    }
    const message =
      'Пройти по базе и перевести в fallback-сквад все подписки с end_date в прошлом.\n\n' +
      'Если включён DEV_MODE — переведёт ТОЛЬКО юзеров из EXPIRY_FALLBACK_DEV_USER_IDS.\n' +
      'Если DEV_MODE выключен — переведёт ВСЕХ с истёкшим сроком (массовая операция!).';
    const ok = await confirmDestructive(message, 'Запустить', 'Прогнать expired в fallback');
    if (ok) scanAndMoveMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="py-24 text-center text-dark-400">Не удалось загрузить данные fallback</div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-dark-700 bg-dark-800 transition-colors hover:bg-dark-700"
          aria-label="Назад"
        >
          <BackIcon />
        </button>
        <div>
          <h1 className="text-xl font-bold text-dark-100">Fallback-сквад при истечении</h1>
          <p className="mt-1 text-sm text-dark-400">
            Юзеры с истёкшей подпиской / исчерпанным трафиком переезжают в спец-сквад (только
            Telegram + банки) вместо полного отключения.
          </p>
        </div>
      </div>

      {/* Status Card */}
      <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2.5 w-2.5 rounded-full ${stats.enabled ? 'bg-success-500 shadow-md shadow-success-500/50' : 'bg-error-500'}`}
            />
            <span className="text-sm font-medium text-dark-100">
              Система {stats.enabled ? 'включена' : 'выключена'}
            </span>
          </div>
          <div className="text-xs text-dark-400">
            Управление: <code className="text-dark-300">EXPIRY_FALLBACK_ENABLED</code> в .env
          </div>
        </div>
        {stats.enabled && (
          <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div>
              <div className="text-dark-500">Fallback-сквад</div>
              <div className="mt-1 break-all font-mono text-dark-200">
                {stats.fallback_squad_uuid || '— не задан —'}
              </div>
            </div>
            <div>
              <div className="text-dark-500">Grace-период</div>
              <div className="mt-1 font-mono text-dark-200">{stats.grace_days} дн.</div>
            </div>
            <div>
              <div className="text-dark-500">Полное отключение через</div>
              <div className="mt-1 font-mono text-dark-200">{stats.total_days} дн.</div>
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Всего в fallback"
          value={stats.total_in_fallback}
          accent={stats.total_in_fallback > 0 ? 'warning' : 'default'}
          hint="Юзеры с урезанным VPN"
        />
        <StatCard
          label="Из-за истечения"
          value={stats.expired_in_fallback}
          hint="expiry_fallback_active=true"
        />
        <StatCard
          label="Из-за трафика"
          value={stats.traffic_in_fallback}
          hint="traffic_fallback_active=true"
        />
      </div>

      {/* Actions */}
      <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-5">
        <h2 className="mb-3 text-sm font-semibold text-dark-100">Действия</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={handleScanAndMove}
            disabled={scanAndMoveMutation.isPending || !stats.enabled}
            className="flex flex-col items-start rounded-xl border border-warning-500/40 bg-warning-500/5 p-4 text-left transition-all hover:border-warning-500/60 hover:bg-warning-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="text-sm font-semibold text-warning-300">
              🚀 Прогнать expired в fallback
            </div>
            <div className="mt-1 text-xs text-dark-400">
              Сканирует БД и переводит в fallback все подписки с истёкшим сроком. В DEV_MODE —
              только юзеров из whitelist.
            </div>
            {scanAndMoveMutation.isPending && (
              <div className="mt-2 text-xs text-warning-400">Сканирую…</div>
            )}
          </button>

          <button
            type="button"
            onClick={handleReconcile}
            disabled={reconcileMutation.isPending || !stats.enabled}
            className="flex flex-col items-start rounded-xl border border-accent-500/30 bg-accent-500/5 p-4 text-left transition-all hover:border-accent-500/50 hover:bg-accent-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="text-sm font-semibold text-accent-300">
              🔁 Запустить reconcile сейчас
            </div>
            <div className="mt-1 text-xs text-dark-400">
              Не ждать 15 мин. Подберёт потерянные вебхуки, обнаружит внешние продления через панель
              и продлит grace.
            </div>
            {reconcileMutation.isPending && (
              <div className="mt-2 text-xs text-accent-400">Выполняется…</div>
            )}
          </button>

          <button
            type="button"
            onClick={handleRestoreAll}
            disabled={
              restoreAllMutation.isPending || !stats.enabled || stats.total_in_fallback === 0
            }
            className="flex flex-col items-start rounded-xl border border-error-500/30 bg-error-500/5 p-4 text-left transition-all hover:border-error-500/50 hover:bg-error-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="text-sm font-semibold text-error-300">♻️ Вернуть всех из fallback</div>
            <div className="mt-1 text-xs text-dark-400">
              Аварийная операция. Возвращает всех в исходные сквады. Юзеры с истёкшей подпиской
              снова потеряют VPN.
            </div>
            {restoreAllMutation.isPending && (
              <div className="mt-2 text-xs text-error-400">Возвращаю…</div>
            )}
          </button>

          <button
            type="button"
            onClick={handleCleanup}
            disabled={cleanupMutation.isPending}
            className="flex flex-col items-start rounded-xl border border-error-500/30 bg-error-500/5 p-4 text-left transition-all hover:border-error-500/50 hover:bg-error-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div className="text-sm font-semibold text-error-300">🗑 Удалить старых EXPIRED</div>
            <div className="mt-1 text-xs text-dark-400">
              Удаляет юзеров с истечённой давно подпиской и нулевым балансом. Период через
              INACTIVE_USER_DELETE_MONTHS в .env.
            </div>
            {cleanupMutation.isPending && (
              <div className="mt-2 text-xs text-error-400">Удаляю…</div>
            )}
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-dark-300">
        <div className="font-semibold text-blue-400">📖 Как работает</div>
        <ul className="mt-2 list-inside list-disc space-y-1 text-dark-400">
          <li>
            Когда подписка истекает → юзер переезжает в fallback-сквад (Remnawave получает grace +
            {stats.grace_days} дней).
          </li>
          <li>
            Periodic reconcile раз в 15 мин: продлевает grace, обнаруживает внешние продления через
            панель, подбирает потерянные вебхуки.
          </li>
          <li>При продлении подписки (бот/кабинет/автопродление) — авто-возврат.</li>
          <li>
            Если юзер сидит в fallback больше {stats.total_days} дней — полное отключение (если
            EXPIRED_CLEANUP_ENABLED=true и баланс=0).
          </li>
        </ul>
      </div>
    </div>
  );
}
