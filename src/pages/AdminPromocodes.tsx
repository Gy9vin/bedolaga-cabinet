import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { promocodesApi, PromoCode, PromoCodeDetail, PromoCodeType } from '../api/promocodes';
import { AdminBackButton } from '../components/admin';

// Icons

const PlusIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
  </svg>
);

const EditIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
    />
  </svg>
);

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const XIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CopyIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
    />
  </svg>
);

const ChartIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
    />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const UserIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
    />
  </svg>
);

// Helper functions
const getTypeLabel = (type: PromoCodeType): string => {
  const labels: Record<PromoCodeType, string> = {
    balance: i18n.t('admin.promocodes.type.balance'),
    subscription_days: i18n.t('admin.promocodes.type.subscriptionDays'),
    trial_subscription: i18n.t('admin.promocodes.type.trialSubscription'),
    promo_group: i18n.t('admin.promocodes.type.promoGroup'),
    discount: i18n.t('admin.promocodes.type.discount'),
  };
  return labels[type] || type;
};

const getTypeColor = (type: PromoCodeType): string => {
  const colors: Record<PromoCodeType, string> = {
    balance: 'bg-success-500/20 text-success-400',
    subscription_days: 'bg-accent-500/20 text-accent-400',
    trial_subscription: 'bg-accent-500/20 text-accent-400',
    promo_group: 'bg-warning-500/20 text-warning-400',
    discount: 'bg-pink-500/20 text-pink-400',
  };
  return colors[type] || 'bg-dark-600 text-dark-300';
};

const formatDate = (date: string | null): string => {
  if (!date) return '-';
  const localeMap: Record<string, string> = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', fa: 'fa-IR' };
  const locale = localeMap[i18n.language] || 'ru-RU';
  return new Date(date).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (date: string | null): string => {
  if (!date) return '-';
  const localeMap: Record<string, string> = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', fa: 'fa-IR' };
  const locale = localeMap[i18n.language] || 'ru-RU';
  return new Date(date).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Promocode Stats Modal
interface PromocodeStatsModalProps {
  promocode: PromoCodeDetail;
  onClose: () => void;
  onEdit: () => void;
}

function PromocodeStatsModal({ promocode, onClose, onEdit }: PromocodeStatsModalProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-dark-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dark-700 p-4">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-lg px-3 py-1.5 font-mono text-lg font-bold ${getTypeColor(promocode.type)}`}
            >
              {promocode.code}
            </div>
            <span className={`rounded px-2 py-0.5 text-xs ${getTypeColor(promocode.type)}`}>
              {getTypeLabel(promocode.type)}
            </span>
            {!promocode.is_active && (
              <span className="rounded bg-dark-600 px-2 py-0.5 text-xs text-dark-400">
                {t('admin.promocodes.stats.inactive')}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 transition-colors hover:bg-dark-700">
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-dark-700/50 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-dark-100">{promocode.total_uses}</div>
              <div className="text-sm text-dark-400">{t('admin.promocodes.stats.totalUses')}</div>
            </div>
            <div className="rounded-xl bg-dark-700/50 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-success-400">{promocode.today_uses}</div>
              <div className="text-sm text-dark-400">{t('admin.promocodes.stats.today')}</div>
            </div>
            <div className="rounded-xl bg-dark-700/50 p-4 text-center">
              <div className="mb-1 text-3xl font-bold text-accent-400">
                {promocode.max_uses === 0 ? '∞' : promocode.uses_left}
              </div>
              <div className="text-sm text-dark-400">{t('admin.promocodes.stats.remaining')}</div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 rounded-xl bg-dark-700/50 p-4">
            <h4 className="mb-3 font-medium text-dark-200">
              {t('admin.promocodes.stats.details')}
            </h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-400">{t('admin.promocodes.stats.type')}:</span>
                <span className="text-dark-200">{getTypeLabel(promocode.type)}</span>
              </div>
              {promocode.type === 'balance' && (
                <div className="flex justify-between">
                  <span className="text-dark-400">{t('admin.promocodes.stats.bonus')}:</span>
                  <span className="text-success-400">
                    +{promocode.balance_bonus_rubles} {t('admin.promocodes.form.rub')}
                  </span>
                </div>
              )}
              {(promocode.type === 'subscription_days' ||
                promocode.type === 'trial_subscription') && (
                <div className="flex justify-between">
                  <span className="text-dark-400">{t('admin.promocodes.stats.daysLabel')}:</span>
                  <span className="text-accent-400">+{promocode.subscription_days}</span>
                </div>
              )}
              {promocode.type === 'discount' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-dark-400">
                      {t('admin.promocodes.stats.discountLabel')}:
                    </span>
                    <span className="text-pink-400">-{promocode.balance_bonus_kopeks}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-400">{t('admin.promocodes.stats.validFor')}:</span>
                    <span className="text-pink-400">
                      {t('admin.promocodes.stats.hoursValue', {
                        count: promocode.subscription_days,
                      })}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-dark-400">{t('admin.promocodes.stats.limit')}:</span>
                <span className="text-dark-200">
                  {promocode.current_uses}/{promocode.max_uses === 0 ? '∞' : promocode.max_uses}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">{t('admin.promocodes.stats.status')}:</span>
                <span className={promocode.is_valid ? 'text-success-400' : 'text-error-400'}>
                  {promocode.is_valid
                    ? t('admin.promocodes.stats.active')
                    : t('admin.promocodes.stats.inactive')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">{t('admin.promocodes.stats.created')}:</span>
                <span className="text-dark-200">{formatDateTime(promocode.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">{t('admin.promocodes.stats.validUntil')}:</span>
                <span className="text-dark-200">
                  {promocode.valid_until
                    ? formatDate(promocode.valid_until)
                    : t('admin.promocodes.stats.unlimited')}
                </span>
              </div>
              {promocode.first_purchase_only && (
                <div className="col-span-2 flex justify-between">
                  <span className="text-dark-400">{t('admin.promocodes.stats.restriction')}:</span>
                  <span className="text-warning-400">
                    {t('admin.promocodes.stats.firstPurchaseOnly')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Usage History */}
          <div className="rounded-xl bg-dark-700/50 p-4">
            <h4 className="mb-3 flex items-center gap-2 font-medium text-dark-200">
              <ClockIcon />
              {t('admin.promocodes.stats.usageHistory')}
            </h4>
            {promocode.recent_uses.length === 0 ? (
              <p className="py-4 text-center text-sm text-dark-500">
                {t('admin.promocodes.stats.noUsages')}
              </p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {promocode.recent_uses.map((use) => (
                  <div
                    key={use.id}
                    className="flex items-center justify-between rounded-lg bg-dark-600/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-dark-500">
                        <UserIcon />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-dark-200">
                          {use.user_full_name || use.user_username || `User #${use.user_id}`}
                        </div>
                        {use.user_username && (
                          <div className="text-xs text-dark-500">@{use.user_username}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-dark-400">{formatDateTime(use.used_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-dark-700 p-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-dark-300 transition-colors hover:text-dark-100"
          >
            {t('admin.promocodes.modal.close')}
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-white transition-colors hover:bg-accent-600"
          >
            <EditIcon />
            {t('admin.promocodes.modal.edit')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPromocodes() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [viewingPromocode, setViewingPromocode] = useState<PromoCodeDetail | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Query
  const { data: promocodesData, isLoading } = useQuery({
    queryKey: ['admin-promocodes'],
    queryFn: () => promocodesApi.getPromocodes({ limit: 100 }),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: promocodesApi.deletePromocode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-promocodes'] });
      setDeleteConfirm(null);
    },
  });

  const handleViewStats = async (id: number) => {
    try {
      const detail = await promocodesApi.getPromocode(id);
      setViewingPromocode(detail);
    } catch (error) {
      console.error('Failed to load promocode stats:', error);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const promocodes = promocodesData?.items || [];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AdminBackButton />
          <div>
            <h1 className="text-xl font-semibold text-dark-100">{t('admin.promocodes.title')}</h1>
            <p className="text-sm text-dark-400">{t('admin.promocodes.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin/promocodes/create')}
          className="flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-white transition-colors hover:bg-accent-600"
        >
          <PlusIcon />
          {t('admin.promocodes.addPromocode')}
        </button>
      </div>

      {/* Stats Overview */}
      {promocodes.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
            <div className="text-2xl font-bold text-dark-100">{promocodes.length}</div>
            <div className="text-xs text-dark-400">
              {t('admin.promocodes.stats.totalPromocodes')}
            </div>
          </div>
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
            <div className="text-2xl font-bold text-success-400">
              {promocodes.filter((p) => p.is_active && p.is_valid).length}
            </div>
            <div className="text-xs text-dark-400">{t('admin.promocodes.stats.activeCount')}</div>
          </div>
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
            <div className="text-2xl font-bold text-accent-400">
              {promocodes.reduce((sum, p) => sum + p.current_uses, 0)}
            </div>
            <div className="text-xs text-dark-400">{t('admin.promocodes.stats.usagesCount')}</div>
          </div>
          <div className="rounded-xl border border-dark-700 bg-dark-800 p-4">
            <div className="text-2xl font-bold text-warning-400">
              {promocodes.filter((p) => p.uses_left === 0 && p.max_uses > 0).length}
            </div>
            <div className="text-xs text-dark-400">{t('admin.promocodes.stats.exhausted')}</div>
          </div>
        </div>
      )}

      {/* Promocodes List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        </div>
      ) : promocodes.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-dark-400">{t('admin.promocodes.noPromocodes')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {promocodes.map((promo: PromoCode) => (
            <div
              key={promo.id}
              className={`rounded-xl border bg-dark-800 p-4 transition-colors ${
                promo.is_active ? 'border-dark-700' : 'border-dark-700/50 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCode(promo.code)}
                      className="flex items-center gap-1.5 font-mono font-medium text-dark-100 transition-colors hover:text-accent-400"
                    >
                      {promo.code}
                      {copiedCode === promo.code ? <CheckIcon /> : <CopyIcon />}
                    </button>
                    <span className={`rounded px-2 py-0.5 text-xs ${getTypeColor(promo.type)}`}>
                      {getTypeLabel(promo.type)}
                    </span>
                    {!promo.is_active && (
                      <span className="rounded bg-dark-600 px-2 py-0.5 text-xs text-dark-400">
                        {t('admin.promocodes.stats.inactive')}
                      </span>
                    )}
                    {promo.first_purchase_only && (
                      <span className="rounded bg-warning-500/20 px-2 py-0.5 text-xs text-warning-400">
                        {t('admin.promocodes.firstPurchase')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-dark-400">
                    {promo.type === 'balance' && (
                      <span className="text-success-400">
                        +{promo.balance_bonus_rubles} {t('admin.promocodes.form.rub')}
                      </span>
                    )}
                    {(promo.type === 'subscription_days' ||
                      promo.type === 'trial_subscription') && (
                      <span className="text-accent-400">
                        +{promo.subscription_days} {t('admin.promocodes.form.days')}
                      </span>
                    )}
                    {promo.type === 'discount' && (
                      <span className="text-pink-400">
                        {t('admin.promocodes.discountForHours', {
                          percent: promo.balance_bonus_kopeks,
                          hours: promo.subscription_days,
                        })}
                      </span>
                    )}
                    <span>
                      {t('admin.promocodes.used')}: {promo.current_uses}/
                      {promo.max_uses === 0 ? '∞' : promo.max_uses}
                    </span>
                    {promo.valid_until && (
                      <span>
                        {t('admin.promocodes.until')}: {formatDate(promo.valid_until)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewStats(promo.id)}
                    className="rounded-lg bg-dark-700 p-2 text-dark-300 transition-colors hover:bg-accent-500/20 hover:text-accent-400"
                    title={t('admin.promocodes.actions.stats')}
                  >
                    <ChartIcon />
                  </button>
                  <button
                    onClick={() => navigate(`/admin/promocodes/${promo.id}/edit`)}
                    className="rounded-lg bg-dark-700 p-2 text-dark-300 transition-colors hover:bg-dark-600 hover:text-dark-100"
                    title={t('admin.promocodes.actions.edit')}
                  >
                    <EditIcon />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(promo.id)}
                    className="rounded-lg bg-dark-700 p-2 text-dark-300 transition-colors hover:bg-error-500/20 hover:text-error-400"
                    title={t('admin.promocodes.actions.delete')}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Promocode Stats Modal */}
      {viewingPromocode && (
        <PromocodeStatsModal
          promocode={viewingPromocode}
          onClose={() => setViewingPromocode(null)}
          onEdit={() => {
            navigate(`/admin/promocodes/${viewingPromocode.id}/edit`);
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl bg-dark-800 p-6">
            <h3 className="mb-2 text-lg font-semibold text-dark-100">
              {t('admin.promocodes.confirm.deletePromocode')}
            </h3>
            <p className="mb-6 text-dark-400">
              {t('admin.promocodes.confirm.deletePromocodeText')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-dark-300 transition-colors hover:text-dark-100"
              >
                {t('admin.promocodes.form.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                className="rounded-lg bg-error-500 px-4 py-2 text-white transition-colors hover:bg-error-600"
              >
                {t('admin.promocodes.confirm.deleteButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
