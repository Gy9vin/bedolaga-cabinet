import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import SimpleScreen from './SimpleScreen';
import SimpleStat from './SimpleStat';
import SimpleRow from './SimpleRow';
import SimpleGroup from './SimpleGroup';
import { Button } from '@/components/primitives/Button/Button';
import { BentoCard } from '@/components/ui/BentoCard';
import { usePlatform } from '@/platform';
import { useUiMode } from '@/hooks/useUiMode';
import { referralApi } from '../../api/referral';
import { withdrawalApi } from '../../api/withdrawals';
import { brandingApi } from '../../api/branding';
import { copyToClipboard } from '../../utils/clipboard';
import { formatPrice } from '../../utils/format';

type FeedItem = {
  id: string;
  title: string;
  subtitle: string;
  value: string | null;
  positive: boolean;
  createdAt: string;
};

/**
 * Экран «Рефералы» простого режима: пригласить, увидеть кто пришёл и
 * вывести заработанное. Кабинетная ссылка идёт первой (мокап), Telegram —
 * второй. Анкету партнёра здесь не показываем вовсе — для вывода она не
 * нужна, это отдельный B2B-инструмент из полного кабинета.
 */
export default function SimpleReferral() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { openTelegramLink } = usePlatform();
  const { setMode } = useUiMode();

  const [copiedLink, setCopiedLink] = useState<'cabinet' | 'bot' | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const { data: info, isLoading } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
  });

  const { data: terms } = useQuery({
    queryKey: ['referral-terms'],
    queryFn: referralApi.getReferralTerms,
  });

  const { data: referralList } = useQuery({
    queryKey: ['referral-list'],
    queryFn: () => referralApi.getReferralList({ per_page: 8 }),
  });

  const { data: earnings } = useQuery({
    queryKey: ['referral-earnings'],
    queryFn: () => referralApi.getReferralEarnings({ per_page: 8 }),
  });

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: brandingApi.getBranding,
    staleTime: 60000,
  });

  const { data: widgetConfig } = useQuery({
    queryKey: ['telegram-widget-config'],
    queryFn: brandingApi.getTelegramWidgetConfig,
    staleTime: 60000,
  });

  const { data: withdrawalBalance } = useQuery({
    queryKey: ['withdrawal-balance'],
    queryFn: withdrawalApi.getBalance,
    enabled: terms?.partner_section_visible !== false,
  });

  const cabinetLink = info?.referral_code
    ? `${window.location.origin}/login?ref=${info.referral_code}`
    : '';

  const botUsername =
    widgetConfig?.bot_username || import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';
  const botLink =
    botUsername && info?.referral_code
      ? `https://t.me/${botUsername}?start=${info.referral_code}`
      : '';

  const copyLink = async (link: string, type: 'cabinet' | 'bot') => {
    if (!link) return;
    try {
      await copyToClipboard(link);
      setCopiedLink(type);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      /* clipboard write failed silently */
    }
  };

  const shareLink = () => {
    if (!cabinetLink) return;
    const shareText = t('referral.shareMessage', {
      percent: info?.commission_percent || 0,
      botName: branding?.name || import.meta.env.VITE_APP_NAME || 'Cabinet',
    });

    if (navigator.share) {
      navigator
        .share({ title: t('simple.referral.title'), text: shareText, url: cabinetLink })
        .catch(() => {});
      return;
    }

    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(cabinetLink)}&text=${encodeURIComponent(shareText)}`;
    openTelegramLink(telegramUrl);
  };

  const openQr = async () => {
    if (!cabinetLink) return;
    try {
      const dataUrl = await QRCode.toDataURL(cabinetLink, {
        width: 280,
        margin: 2,
        color: { dark: '#000000', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setShowQr(true);
    } catch {
      /* ignore */
    }
  };

  // Приглашённые и начисления — один список (бриф задачи 6), а не два.
  const feed: FeedItem[] = useMemo(() => {
    const referralItems: FeedItem[] = (referralList?.items ?? []).map((ref) => ({
      id: `ref-${ref.id}`,
      title: ref.first_name || ref.username || t('referral.anonymousUser', { id: ref.id }),
      subtitle: ref.has_paid ? t('simple.referral.feedPaid') : t('simple.referral.feedWaiting'),
      value: null,
      positive: false,
      createdAt: ref.created_at,
    }));
    const earningItems: FeedItem[] = (earnings?.items ?? []).map((earning) => ({
      id: `earn-${earning.id}`,
      title:
        earning.referral_first_name || earning.referral_username || t('referral.anonymousReferral'),
      subtitle: t(`referral.reasons.${earning.reason}`, earning.reason),
      value: formatPrice(earning.amount_kopeks),
      positive: true,
      createdAt: earning.created_at,
    }));
    return [...referralItems, ...earningItems]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [referralList, earnings, t]);

  const withdrawalVisible = terms?.partner_section_visible !== false;
  const availableKopeks = withdrawalBalance?.available_total ?? 0;
  const minAmountKopeks = withdrawalBalance?.min_amount_kopeks ?? 0;
  const canWithdraw = withdrawalBalance?.can_request ?? false;
  const remainingKopeks = Math.max(minAmountKopeks - availableKopeks, 0);
  const progressPercent =
    minAmountKopeks > 0 ? Math.min(100, (availableKopeks / minAmountKopeks) * 100) : 100;

  if (isLoading) {
    return (
      <SimpleScreen title={t('simple.referral.title')}>
        <div className="skeleton h-40 w-full rounded-2xl" />
      </SimpleScreen>
    );
  }

  return (
    <SimpleScreen title={t('simple.referral.title')}>
      <BentoCard className="border-accent-500/30 bg-accent-500/10">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent-400">
          {t('simple.referral.linksLabel')}
        </span>
        <LinkGroup
          caption={t('simple.referral.cabinetLinkCaption')}
          link={cabinetLink}
          copied={copiedLink === 'cabinet'}
          onCopy={() => copyLink(cabinetLink, 'cabinet')}
          t={t}
        />
        {botLink && (
          <LinkGroup
            caption={t('simple.referral.botLinkCaption')}
            link={botLink}
            copied={copiedLink === 'bot'}
            onCopy={() => copyLink(botLink, 'bot')}
            t={t}
          />
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="primary" size="sm" onClick={shareLink} disabled={!cabinetLink}>
            {t('simple.referral.shareButton')}
          </Button>
          <Button variant="secondary" size="sm" onClick={openQr} disabled={!cabinetLink}>
            {t('simple.referral.qrButton')}
          </Button>
        </div>
      </BentoCard>

      <div className="grid grid-cols-3 gap-2.5">
        <SimpleStat label={t('simple.referral.statCame')} value={info?.total_referrals ?? 0} />
        <SimpleStat
          label={t('simple.referral.statEarned')}
          value={formatPrice(info?.total_earnings_kopeks ?? 0)}
        />
        <SimpleStat
          label={t('simple.referral.statAvailable')}
          value={formatPrice(availableKopeks)}
        />
      </div>
      <p className="-mt-1 text-xs text-dark-500">
        {t('simple.referral.commissionHint', { percent: info?.commission_percent ?? 0 })}
      </p>

      {withdrawalVisible && (
        <BentoCard>
          <p className="font-medium text-dark-100">{t('simple.referral.withdrawalTitle')}</p>
          <p className="mt-0.5 text-sm text-dark-400">
            {canWithdraw
              ? t('simple.referral.withdrawalReady')
              : t('simple.referral.withdrawalRemaining', { amount: formatPrice(remainingKopeks) })}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-dark-700/40">
            <div
              className={`h-full rounded-full ${canWithdraw ? 'bg-accent-500' : 'bg-warning-400'}`}
              style={{ width: `${progressPercent}%` }}
              aria-hidden="true"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            disabled={!canWithdraw}
            onClick={() => navigate('/referral/withdrawal/request')}
            className="mt-3"
          >
            {canWithdraw
              ? t('simple.referral.withdrawButtonReady', { amount: formatPrice(availableKopeks) })
              : t('simple.referral.withdrawButtonMin', { amount: formatPrice(minAmountKopeks) })}
          </Button>
        </BentoCard>
      )}

      {feed.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.referral.feedLabel')}
          </span>
          <SimpleGroup className="mt-2">
            {feed.map((item) => (
              <SimpleRow
                key={item.id}
                title={item.title}
                subtitle={item.subtitle}
                value={
                  item.value ? (
                    <span className={item.positive ? 'text-success-400' : undefined}>
                      +{item.value}
                    </span>
                  ) : undefined
                }
              />
            ))}
          </SimpleGroup>
          <button
            type="button"
            // Лента показывает только последние 8 записей — «Показать всех»
            // ведёт в расширенный режим, где для рефералов есть полный
            // список с пагинацией (тот же экран /referral, просто не
            // упрощённый — переключаем режим, а не уходим на другой роут).
            onClick={() => setMode('advanced')}
            className="mt-2 text-center text-sm font-medium text-accent-400"
          >
            {t('simple.referral.showAllLink', { count: info?.total_referrals ?? 0 })}
          </button>
        </div>
      )}

      {showQr && qrDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 pt-20 backdrop-blur-sm"
          onClick={() => setShowQr(false)}
        >
          <div
            className="mx-4 mb-10 w-full max-w-xs rounded-2xl border border-dark-700/50 bg-dark-800 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 text-center text-lg font-medium text-dark-100">
              {t('simple.referral.qrButton')}
            </div>
            <div className="flex justify-center rounded-xl bg-white p-4">
              <img src={qrDataUrl} alt="QR" className="h-auto w-full max-w-[248px]" />
            </div>
            <Button variant="secondary" fullWidth onClick={() => setShowQr(false)} className="mt-4">
              {t('common.close')}
            </Button>
          </div>
        </div>
      )}
    </SimpleScreen>
  );
}

function LinkGroup({
  caption,
  link,
  copied,
  onCopy,
  t,
}: {
  caption: string;
  link: string;
  copied: boolean;
  onCopy: () => void;
  t: (key: string) => string;
}) {
  return (
    <div className="mt-2.5 flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-accent-400/85">
        {caption}
      </p>
      <div className="flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 items-center overflow-hidden text-ellipsis whitespace-nowrap rounded-xl border border-accent-500/30 bg-dark-900/70 px-3 py-2.5 font-mono text-xs text-dark-100">
          {link}
        </div>
        <button
          type="button"
          onClick={onCopy}
          disabled={!link}
          className="shrink-0 rounded-xl border border-dark-700/50 bg-dark-900/70 px-3 py-2.5 text-xs font-semibold text-dark-200"
        >
          {copied ? t('referral.copied') : t('referral.copyLink')}
        </button>
      </div>
    </div>
  );
}
