import { useTranslation } from 'react-i18next';
import { useBlockingStore } from '../../store/blocking';

/**
 * Full-screen block shown when the backend returns
 * `403 {detail: {code: "account_deleted", ...}}`.
 *
 * Triggered for two situations:
 *   * Token-bearing requests where the user row was flipped to DELETED
 *     by the inactivity-cleanup job out-of-band.
 *   * Email/password login of a previously-DELETED account where we
 *     have no Telegram signature to auto-revive on the server side.
 *
 * Recovery: pressing /start in the bot triggers the existing revival
 * flow (handlers/start.py), which flips status back to ACTIVE. The
 * "Retry" button reloads the SPA so the next request observes the new
 * status and clears the block.
 */
export default function AccountDeletedScreen() {
  const { t } = useTranslation();
  const info = useBlockingStore((state) => state.accountDeletedInfo);

  const deepLink = info?.telegram_deep_link?.trim() || null;
  const handleOpenBot = () => {
    if (deepLink) {
      window.open(deepLink, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRetry = () => {
    // Reload rather than just clearing the store: we want a fresh
    // network round-trip against the (hopefully now-revived) row.
    useBlockingStore.getState().clearBlocking();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-dark-950 p-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-dark-800">
            <svg
              className="h-12 w-12 text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        <h1 className="mb-4 text-2xl font-bold text-white">{t('blocking.accountDeleted.title')}</h1>

        <p className="mb-6 text-lg text-gray-400">{t('blocking.accountDeleted.description')}</p>

        <div className="space-y-3">
          {deepLink && (
            <button
              type="button"
              onClick={handleOpenBot}
              className="block w-full rounded-xl bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-dark-950"
            >
              {t('blocking.accountDeleted.openBot')}
            </button>
          )}
          <button
            type="button"
            onClick={handleRetry}
            className="block w-full rounded-xl bg-dark-800 px-6 py-3 text-base font-medium text-gray-200 transition-colors hover:bg-dark-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-dark-950"
          >
            {t('blocking.accountDeleted.retry')}
          </button>
        </div>

        <p className="mt-8 text-sm text-gray-500">{t('blocking.accountDeleted.hint')}</p>
      </div>
    </div>
  );
}
