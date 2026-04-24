import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useHaptic, useNotify } from '../platform';
import { adminChannelsApi, type ChannelReport } from '../api/adminChannels';
import { AdminBackButton } from '../components/admin';

const RefreshIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
    />
  </svg>
);

const PlayIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
    />
  </svg>
);

const StopIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
    />
  </svg>
);

const DownloadIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);

const STATUS_STYLES: Record<ChannelReport['status'], { bg: string; text: string; label: string }> =
  {
    pending: { bg: 'bg-dark-700', text: 'text-dark-300', label: 'Ожидание' },
    running: { bg: 'bg-accent-500/20', text: 'text-accent-400', label: 'Выполняется' },
    completed: { bg: 'bg-success-500/20', text: 'text-success-400', label: 'Готов' },
    failed: { bg: 'bg-error-500/20', text: 'text-error-400', label: 'Ошибка' },
    cancelled: { bg: 'bg-warning-500/20', text: 'text-warning-400', label: 'Отменён' },
  };

export default function AdminChannelMembershipReport() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const notify = useNotify();
  const { id } = useParams<{ id: string }>();

  const channelDbId = id ? parseInt(id, 10) : NaN;
  const [reportId, setReportId] = useState<string | null>(null);

  const { data: channelsData } = useQuery({
    queryKey: ['admin-channels'],
    queryFn: adminChannelsApi.list,
  });

  const channel = useMemo(
    () => channelsData?.items.find((ch) => ch.id === channelDbId),
    [channelsData, channelDbId],
  );

  const { data: report } = useQuery({
    queryKey: ['admin-channel-report', reportId],
    queryFn: () => adminChannelsApi.getReport(reportId as string),
    enabled: !!reportId,
    refetchInterval: (query) => {
      const data = query.state.data as ChannelReport | undefined;
      if (data && (data.status === 'pending' || data.status === 'running')) {
        return 3000;
      }
      return false;
    },
  });

  const startMutation = useMutation({
    mutationFn: () => adminChannelsApi.startReport(channelDbId),
    onSuccess: (res) => {
      setReportId(res.report_id);
      haptic.impact('light');
      queryClient.invalidateQueries({ queryKey: ['admin-channel-report'] });
    },
    onError: (err: unknown) => {
      haptic.notification('error');
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      notify.error(msg || t('common.error'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => adminChannelsApi.cancelReport(reportId as string),
    onSuccess: () => {
      haptic.impact('medium');
      queryClient.invalidateQueries({ queryKey: ['admin-channel-report', reportId] });
    },
    onError: () => {
      haptic.notification('error');
      notify.error(t('common.error'));
    },
  });

  const handleDownload = async () => {
    if (!reportId) return;
    try {
      const blob = await adminChannelsApi.downloadReportCsv(reportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `channel_report_${channelDbId}_${reportId.slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      haptic.impact('light');
    } catch {
      haptic.notification('error');
      notify.error(t('common.error'));
    }
  };

  if (isNaN(channelDbId)) {
    navigate('/admin/channel-subscriptions');
    return null;
  }

  const total = report?.total ?? 0;
  const processed = report?.processed ?? 0;
  const percent = total > 0 ? (processed / total) * 100 : 0;
  const isRunning = report?.status === 'pending' || report?.status === 'running';
  const isDone = report?.status === 'completed';

  const channelTitle = report?.channel_title || channel?.title || channel?.channel_id || '—';
  const channelId = report?.channel_id || channel?.channel_id || '—';

  const statusStyle = report ? STATUS_STYLES[report.status] : null;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AdminBackButton to="/admin/channel-subscriptions" />
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-dark-100">Отчёт: кто не в канале</h1>
              {statusStyle && (
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}
                >
                  {statusStyle.label}
                </span>
              )}
            </div>
            <p className="text-sm text-dark-400">
              {channelTitle}
              {channelId && channelId !== channelTitle && (
                <span className="ml-2 text-dark-500">
                  <code>{channelId}</code>
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4">
        <p className="text-sm text-dark-300">
          Сверка проходит через Telegram API: бот вызывает <code>getChatMember</code> для каждого
          активного подписчика. Данные о членстве обновляются в БД и кеше. В CSV попадут только те,
          кого в канале нет.
        </p>
        <p className="mt-2 text-xs text-dark-500">
          Скорость: ~20 проверок/сек. Пользователи, зарегистрированные только по email, не
          проверяются (у них нет Telegram ID).
        </p>
      </div>

      {!reportId && (
        <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-6 text-center">
          <button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlayIcon />
            {startMutation.isPending ? 'Запуск…' : 'Запустить отчёт'}
          </button>
        </div>
      )}

      {report && (
        <div className="space-y-4">
          <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-dark-400">Прогресс</span>
              <span className="font-medium text-dark-100">{percent.toFixed(1)}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-dark-700">
              <div
                className="h-full bg-gradient-to-r from-accent-500 to-accent-400 transition-all duration-300"
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-dark-500">Всего</p>
                <p className="font-medium text-dark-100">{total}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500">Проверено</p>
                <p className="font-medium text-dark-100">{processed}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500">✅ В канале</p>
                <p className="font-medium text-success-400">{report.in_channel}</p>
              </div>
              <div>
                <p className="text-xs text-dark-500">❌ Не в канале</p>
                <p className="font-medium text-error-400">{report.not_in_channel}</p>
              </div>
            </div>
            {report.error_message && (
              <p className="mt-3 rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-400">
                {report.error_message}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isRunning && (
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-warning-500/20 px-4 py-2 text-sm text-warning-400 transition-colors hover:bg-warning-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <StopIcon />
                Отменить
              </button>
            )}
            {!isRunning && (
              <button
                onClick={() => {
                  setReportId(null);
                  startMutation.mutate();
                }}
                disabled={startMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-500/20 px-4 py-2 text-sm text-accent-400 transition-colors hover:bg-accent-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshIcon />
                Запустить заново
              </button>
            )}
            {isDone && report.has_csv && (
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-success-600"
              >
                <DownloadIcon />
                Скачать CSV ({report.not_in_channel})
              </button>
            )}
            {isDone && !report.has_csv && (
              <p className="rounded-lg bg-success-500/10 px-3 py-2 text-sm text-success-400">
                Все подписчики состоят в канале — CSV не требуется.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
