import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { adminGoogleMigrationApi } from '../api/adminGoogleMigration';
import { usePlatform } from '../platform/hooks/usePlatform';
import { useNativeDialog } from '../platform/hooks/useNativeDialog';
import { BackIcon } from '@/components/icons';

export default function AdminGoogleMigration() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { capabilities } = usePlatform();
  const { confirm: confirmDialog } = useNativeDialog();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['google-migration-status'],
    queryFn: adminGoogleMigrationApi.getStatus,
    refetchInterval: (query) => (query.state.data?.run.running ? 2000 : false),
  });

  const atRisk = useQuery({
    queryKey: ['google-at-risk'],
    queryFn: adminGoogleMigrationApi.getAtRisk,
  });

  const send = useMutation({
    mutationFn: adminGoogleMigrationApi.sendInvites,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['google-migration-status'] }),
  });

  const stats = data?.stats;
  const run = data?.run;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {!capabilities.hasBackButton && (
          <button
            onClick={() => navigate('/admin')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-dark-700 bg-dark-800 transition-colors hover:border-dark-600"
          >
            <BackIcon />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold text-dark-100">{t('googleMigration.title')}</h1>
          <p className="text-sm text-dark-400">{t('googleMigration.description')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-8 text-center text-dark-400">
          {t('common.loading')}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label={t('googleMigration.total')} value={stats?.total ?? 0} />
            <Stat label={t('googleMigration.googleOnly')} value={stats?.google_only ?? 0} />
            <Stat label={t('googleMigration.withPassword')} value={stats?.with_password ?? 0} />
          </div>

          {/* In-progress banner */}
          {run?.running && (
            <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-3 text-sm text-dark-300">
              {t('googleMigration.inProgress', {
                sent: run.sent,
                total: run.total,
                failed: run.failed,
              })}
            </div>
          )}

          {/* Last run summary */}
          {!run?.running && run?.finished_at && (
            <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-3 text-sm text-dark-300">
              {t('googleMigration.lastRun', { sent: run.sent, failed: run.failed })}
            </div>
          )}

          {/* Action button */}
          <button
            className="flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-on-accent transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={send.isPending || run?.running}
            onClick={async () => {
              if (await confirmDialog(t('googleMigration.confirm', { count: stats?.total ?? 0 })))
                send.mutate();
            }}
          >
            {run?.running ? t('googleMigration.sending') : t('googleMigration.sendButton')}
          </button>

          {/* At-risk list */}
          <h2 className="mb-2 mt-8 text-lg font-semibold text-dark-100">
            {t('googleMigration.atRiskTitle')} ({atRisk.data?.count ?? 0})
          </h2>
          <div className="max-h-96 overflow-auto rounded-xl border border-dark-700 bg-dark-800/50">
            {(atRisk.data?.users ?? []).map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between border-b border-dark-700 px-3 py-2 text-sm last:border-b-0"
              >
                <span className="text-dark-100">{u.email}</span>
                <span className="flex gap-2">
                  {!u.has_telegram && (
                    <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
                      {t('googleMigration.noTelegram')}
                    </span>
                  )}
                  {u.blocked_bot && (
                    <span className="rounded bg-red-500/15 px-2 py-0.5 text-xs text-red-300">
                      {t('googleMigration.blockedBot')}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-dark-700 bg-dark-800/50 p-4 text-center">
      <div className="text-3xl font-bold text-dark-100">{value}</div>
      <div className="mt-1 text-xs text-dark-400">{label}</div>
    </div>
  );
}
