import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminUsersApi, type UserListItem } from '../../../api/adminUsers';
import type {
  AdminMergePreviewResponse,
  AdminMergeSubPreview,
  AdminMergeDeviceInfo,
} from '../../../types';
import { useNotify } from '../../../platform/hooks/useNotify';

interface Props {
  primaryUserId: number;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'search' | 'preview' | 'confirming';

export function AdminMergePanel({ primaryUserId, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const notify = useNotify();

  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [secondaryUserId, setSecondaryUserId] = useState<number | null>(null);

  const [preview, setPreview] = useState<AdminMergePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Which user survives: primaryUserId or secondaryUserId
  const [survivorId, setSurvivorId] = useState<number>(primaryUserId);
  // Which subscription's link to keep (null = no explicit choice)
  const [keepSubId, setKeepSubId] = useState<number | null>(null);

  const [mergeLoading, setMergeLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await adminUsersApi.getUsers({ search: searchQuery.trim(), limit: 10 });
      const filtered = res.users.filter((u) => u.id !== primaryUserId);
      setSearchResults(filtered);
    } catch {
      notify.error('Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSecondary = async (user: UserListItem) => {
    setSecondaryUserId(user.id);
    setPreviewLoading(true);
    setStep('preview');
    try {
      const data = await adminUsersApi.getMergePreview(primaryUserId, user.id);
      setPreview(data);
      setSurvivorId(primaryUserId);
      setKeepSubId(null);
    } catch {
      notify.error('Failed to load preview');
      setStep('search');
      setSecondaryUserId(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!secondaryUserId || !preview) return;
    // Determine primary/secondary for the API based on survivor choice:
    // the API treats the FIRST arg as the survivor (primary)
    const [apiPrimary, apiSecondary] =
      survivorId === primaryUserId
        ? [primaryUserId, secondaryUserId]
        : [secondaryUserId, primaryUserId];

    setMergeLoading(true);
    try {
      await adminUsersApi.mergeUsers(apiPrimary, apiSecondary, keepSubId);
      notify.success(t('admin.users.detail.linking.success.merged'));
      onSuccess();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      notify.error(axiosErr?.response?.data?.detail || 'Merge failed');
    } finally {
      setMergeLoading(false);
    }
  };

  const renderDevices = (devices: AdminMergeDeviceInfo[], count: number | null) => {
    if (count === null)
      return (
        <span className="text-xs text-dark-500 italic">
          {t('admin.users.detail.linking.mergeDevicesUnavailable')}
        </span>
      );
    if (count === 0)
      return (
        <span className="text-xs text-dark-500">
          {t('admin.users.detail.linking.mergeDevicesNone')}
        </span>
      );
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {devices.map((d, i) => (
          <span key={i} className="rounded bg-dark-700 px-1.5 py-0.5 text-xs text-dark-300">
            {d.app || d.platform || d.hwid || '?'}
          </span>
        ))}
        {count > devices.length && (
          <span className="text-xs text-dark-500">+{count - devices.length}</span>
        )}
      </div>
    );
  };

  const renderSubCard = (sub: AdminMergeSubPreview, isSelected: boolean, onSelect: () => void) => (
    <div
      key={sub.subscription_id}
      className={`rounded-lg border p-3 text-xs ${
        isSelected ? 'border-accent-500/60 bg-accent-500/10' : 'border-dark-600 bg-dark-800/50'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-dark-100">{sub.tariff_name || sub.status}</span>
        <label className="flex items-center gap-1 cursor-pointer text-dark-300">
          <input
            type="radio"
            name="keep-sub"
            checked={isSelected}
            onChange={onSelect}
            className="accent-accent-500"
          />
          {t('admin.users.detail.linking.mergeChooseLinkLabel')}
        </label>
      </div>
      {sub.end_date && (
        <div className="text-dark-400">{new Date(sub.end_date).toLocaleDateString()}</div>
      )}
      {sub.subscription_url && (
        <div className="mt-1 truncate text-dark-500" title={sub.subscription_url}>
          {sub.subscription_url.slice(0, 48)}&hellip;
        </div>
      )}
      <div className="mt-2">
        <span className="text-dark-400">{t('admin.users.detail.linking.mergeDevicesLabel')}: </span>
        {renderDevices(sub.devices, sub.devices_count)}
      </div>
    </div>
  );

  const renderUserColumn = (
    userPreview: AdminMergePreviewResponse['primary'],
    label: string,
    subs: AdminMergeSubPreview[],
  ) => {
    const isSurvivor = userPreview.id === survivorId;
    return (
      <div
        className={`min-w-0 flex-1 rounded-xl border p-4 ${
          isSurvivor ? 'border-accent-500/50 bg-accent-500/5' : 'border-dark-600 bg-dark-800/30'
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-dark-400">
            {label}
          </span>
          <label className="flex items-center gap-1 cursor-pointer text-xs text-dark-300">
            <input
              type="radio"
              name="survivor"
              checked={isSurvivor}
              onChange={() => setSurvivorId(userPreview.id)}
              className="accent-accent-500"
            />
            {t('admin.users.detail.linking.mergeChooseSurvivorLabel')}
          </label>
        </div>
        <div className="text-sm font-semibold text-dark-100">
          {userPreview.first_name || userPreview.username || `#${userPreview.id}`}
        </div>
        <div className="text-xs text-dark-500 mb-1">#{userPreview.id}</div>
        {userPreview.email && <div className="text-xs text-dark-400">{userPreview.email}</div>}
        <div className="text-xs text-dark-400">{userPreview.auth_methods.join(', ')}</div>
        <div className="mt-3 space-y-2">
          {subs.length === 0 ? (
            <div className="text-xs text-dark-500 italic">
              {t('admin.users.detail.linking.mergeNoSubscription')}
            </div>
          ) : (
            subs.map((sub) =>
              renderSubCard(sub, keepSubId === sub.subscription_id, () =>
                setKeepSubId(sub.subscription_id),
              ),
            )
          )}
        </div>
      </div>
    );
  };

  // ─── SEARCH STEP ───────────────────────────────────────────────────────────
  if (step === 'search') {
    return (
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs text-dark-400">
            {t('admin.users.detail.linking.mergeSearchLabel')}
          </label>
          <div className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('admin.users.detail.linking.mergeSearchPlaceholder')}
              className="input flex-1"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading || !searchQuery.trim()}
              className="rounded-lg bg-accent-500/20 px-3 py-2 text-sm font-medium text-accent-300 hover:bg-accent-500/30 disabled:opacity-50"
            >
              {searchLoading ? '…' : t('admin.users.detail.linking.mergeSearchButton')}
            </button>
          </div>
        </div>

        {searchResults.map((u) => (
          <button
            key={u.id}
            onClick={() => handleSelectSecondary(u)}
            className="w-full rounded-lg border border-dark-600 bg-dark-800/40 p-3 text-left hover:border-dark-500 hover:bg-dark-700/40"
          >
            <div className="text-sm font-medium text-dark-100">
              {u.full_name || u.username || `#${u.id}`}
            </div>
            <div className="text-xs text-dark-500">
              #{u.id}
              {u.subscription_end_date &&
                ` · ${t('admin.users.detail.linking.mergeSearchSubUntil')} ${new Date(u.subscription_end_date).toLocaleDateString()}`}
            </div>
          </button>
        ))}

        <button
          onClick={onClose}
          className="w-full rounded-lg bg-dark-700 py-2 text-sm text-dark-400 hover:bg-dark-600"
        >
          {t('common.cancel')}
        </button>
      </div>
    );
  }

  // ─── PREVIEW STEP ──────────────────────────────────────────────────────────
  if (step === 'preview') {
    if (previewLoading || !preview) {
      return (
        <div className="flex items-center justify-center py-10 text-dark-400">
          {t('common.loading')}
        </div>
      );
    }

    const primaryPreview = preview.primary;
    const secondaryPreview = preview.secondary;

    const survivorPreview = survivorId === primaryPreview.id ? primaryPreview : secondaryPreview;
    const deletedPreview = survivorId === primaryPreview.id ? secondaryPreview : primaryPreview;

    const survivorLabel =
      survivorPreview.first_name || survivorPreview.username || `#${survivorPreview.id}`;
    const deletedLabel =
      deletedPreview.first_name || deletedPreview.username || `#${deletedPreview.id}`;

    const hasAnySub =
      primaryPreview.subscriptions.length > 0 || secondaryPreview.subscriptions.length > 0;
    const confirmDisabled = mergeLoading || (hasAnySub && keepSubId === null);

    return (
      <div className="space-y-4">
        <div className="text-sm font-semibold text-dark-200">
          {t('admin.users.detail.linking.mergePreviewTitle')}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {renderUserColumn(
            primaryPreview,
            t('admin.users.detail.linking.mergePrimaryAccountLabel'),
            primaryPreview.subscriptions,
          )}
          {renderUserColumn(
            secondaryPreview,
            t('admin.users.detail.linking.mergeSecondaryAccountLabel'),
            secondaryPreview.subscriptions,
          )}
        </div>

        <div className="rounded-lg border border-error-500/30 bg-error-500/10 p-3 text-xs text-error-300">
          {t('admin.users.detail.linking.mergeWarningV2', {
            survivor: survivorLabel,
            deleted: deletedLabel,
          })}
        </div>

        {hasAnySub && keepSubId === null && (
          <div className="text-xs text-warning-400">
            {t('admin.users.detail.linking.mergePickSubHint')}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setStep('search');
              setPreview(null);
              setSecondaryUserId(null);
              setKeepSubId(null);
            }}
            className="flex-1 rounded-lg bg-dark-700 py-2 text-sm text-dark-400 hover:bg-dark-600"
          >
            {t('admin.users.detail.linking.mergeBackToSearch')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="flex-1 rounded-lg bg-error-500 py-2 text-sm font-medium text-white hover:bg-error-600 disabled:opacity-50"
          >
            {mergeLoading ? t('common.loading') : t('admin.users.detail.linking.mergeConfirmV2')}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
