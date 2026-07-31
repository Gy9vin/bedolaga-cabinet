/**
 * Non-blocking dismissible popup shown on cabinet load when:
 * - show_post=true: user hasn't seen the latest main-channel post
 * - needs_subscribe=true: user is not confirmed as subscribed to main channel
 *
 * Throttle rules:
 * - New post: shown once per post (server-side seen via markChannelPostSeen).
 * - Subscribe-only (no new post): shown at most once per 24 h (localStorage).
 *
 * NEVER blocks the cabinet — rendered as a portal over the content.
 */
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { getChannelNudge, markChannelPostSeen, type ChannelNudgeData } from '../api/channelNudge';
import {
  shouldShowChannelNudge,
  readSubscribeDismissedAt,
  writeSubscribeDismissedAt,
} from '../utils/channelNudgeVisibility';

export default function ChannelNudgeModal() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [lastDismissedAt, setLastDismissedAt] = useState<number | null>(null);

  // Read localStorage throttle timestamp once on mount (client-only).
  useEffect(() => {
    setLastDismissedAt(readSubscribeDismissedAt());
  }, []);

  const { data } = useQuery<ChannelNudgeData>({
    queryKey: ['channel-nudge'],
    queryFn: getChannelNudge,
    staleTime: 60_000,
    retry: false,
  });

  const shouldShow =
    !dismissed &&
    data != null &&
    shouldShowChannelNudge({
      show_post: data.show_post,
      needs_subscribe: data.needs_subscribe,
      latest_post: data.latest_post,
      lastDismissedAt,
    });

  // Mark seen server-side as soon as the popup becomes visible (for post nudge).
  useEffect(() => {
    if (shouldShow && data?.latest_post?.id != null) {
      markChannelPostSeen(data.latest_post.id).catch(() => {});
    }
  }, [shouldShow, data?.latest_post?.id]);

  const handleClose = useCallback(() => {
    setDismissed(true);

    if (data?.latest_post?.id != null) {
      // Post nudge: server-side throttle (already called on show, idempotent).
      markChannelPostSeen(data.latest_post.id).catch(() => {});
    } else if (data?.needs_subscribe) {
      // Subscribe-only nudge: client-side 24-h throttle.
      const now = Date.now();
      writeSubscribeDismissedAt(now);
      setLastDismissedAt(now);
    }
  }, [data?.latest_post?.id, data?.needs_subscribe]);

  if (!shouldShow || !data) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      data-testid="channel-nudge-modal"
    >
      {/* Backdrop — clicking it dismisses without blocking navigation */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} aria-hidden="true" />

      {/* Panel */}
      <div className="relative z-10 mx-4 mb-6 w-full max-w-sm rounded-2xl border border-dark-700 bg-dark-900 p-5 shadow-xl sm:mb-0">
        {/* Post block (shown to all when show_post=true) */}
        {data.show_post && data.latest_post && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-dark-100">{t('channelNudge.newPost')}</p>
            {data.latest_post.title && (
              <p className="mt-1 line-clamp-2 text-sm text-dark-300">{data.latest_post.title}</p>
            )}
            <a
              href={data.latest_post.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500"
              onClick={handleClose}
            >
              {t('channelNudge.openPost')}
            </a>
          </div>
        )}

        {/* Subscribe block (shown only when needs_subscribe=true) */}
        {data.needs_subscribe && data.channel && (
          <div className={data.show_post ? 'border-t border-dark-700 pt-4' : ''}>
            <p className="text-sm font-semibold text-dark-100">
              {t('channelNudge.subscribeTitle')}
            </p>
            <p className="mt-1 text-sm text-dark-400">{t('channelNudge.subscribeBody')}</p>
            {data.channel.link && (
              <a
                href={data.channel.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block rounded-lg border border-dark-600 px-4 py-2 text-sm font-medium text-dark-200 hover:bg-dark-800"
                onClick={handleClose}
              >
                {t('channelNudge.subscribeButton')}
              </a>
            )}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={handleClose}
          aria-label={t('channelNudge.close')}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-dark-400 hover:bg-dark-700 hover:text-dark-200"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M12.854 3.146a.5.5 0 0 1 0 .708L8.707 8l4.147 4.146a.5.5 0 0 1-.708.708L8 8.707l-4.146 4.147a.5.5 0 0 1-.708-.708L7.293 8 3.146 3.854a.5.5 0 0 1 .708-.708L8 7.293l4.146-4.147a.5.5 0 0 1 .708 0z" />
          </svg>
        </button>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
