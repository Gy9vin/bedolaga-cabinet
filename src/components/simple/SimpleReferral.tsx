import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
import { formatPrice, formatLongDate } from '../../utils/format';

type FeedItem = {
  id: string;
  title: string;
  subtitle: string;
  value: string | null;
  positive: boolean;
  muted?: boolean;
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

  // Лента «Кто пришёл»: одна строка на человека, без сырых ключей reason.
  const feed: FeedItem[] = useMemo(() => {
    // reason → ключ человеческого статуса (без t(`referral.reasons.${reason}`))
    const reasonToStatus = (reason: string): 'feedPaid' | 'feedTopUp' => {
      if (reason === 'referral_first_payment' || reason === 'referral_subscription_renewal') {
        return 'feedPaid';
      }
      if (
        reason === 'referral_bonus' ||
        reason.startsWith('referral_registration') ||
        reason.includes('topup') ||
        reason.includes('top_up')
      ) {
        return 'feedTopUp';
      }
      // fallback — никогда не показываем сырой ключ
      return 'feedPaid';
    };

    // Индекс начислений по имени пользователя: первое (самое свежее) начисление
    // на человека — именно оно показывается в строке, остальные игнорируются.
    const earningByName = new Map<string, NonNullable<typeof earnings>['items'][number]>();
    for (const e of earnings?.items ?? []) {
      const key = e.referral_first_name || e.referral_username || '';
      if (key && !earningByName.has(key)) {
        earningByName.set(key, e);
      }
    }

    const items: FeedItem[] = [];
    const seen = new Set<string>();

    // referralList — главный источник строк; начисление обогащает его.
    for (const ref of referralList?.items ?? []) {
      const nameKey = ref.first_name || ref.username || String(ref.id);
      if (seen.has(nameKey)) continue;
      seen.add(nameKey);

      const displayName =
        ref.first_name || ref.username || t('referral.anonymousUser', { id: ref.id });
      const earning = earningByName.get(nameKey);

      if (earning) {
        earningByName.delete(nameKey);
        const status = reasonToStatus(earning.reason);
        items.push({
          id: `ref-${ref.id}`,
          title: displayName,
          subtitle: `${formatLongDate(earning.created_at)} · ${t(`simple.referral.${status}`)}`,
          value: formatPrice(earning.amount_kopeks),
          positive: true,
          muted: false,
          createdAt: earning.created_at,
        });
      } else {
        items.push({
          id: `ref-${ref.id}`,
          title: displayName,
          subtitle: `${formatLongDate(ref.created_at)} · ${t('simple.referral.feedWaiting')}`,
          value: t('simple.referral.feedWaitingValue'),
          positive: false,
          muted: true,
          createdAt: ref.created_at,
        });
      }
    }

    // Начисления без пары в referralList (редкий кейс — показываем в конце).
    for (const [nameKey, earning] of earningByName) {
      if (seen.has(nameKey)) continue;
      seen.add(nameKey);
      const displayName =
        earning.referral_first_name || earning.referral_username || t('referral.anonymousReferral');
      const status = reasonToStatus(earning.reason);
      items.push({
        id: `earn-${earning.id}`,
        title: displayName,
        subtitle: `${formatLongDate(earning.created_at)} · ${t(`simple.referral.${status}`)}`,
        value: formatPrice(earning.amount_kopeks),
        positive: true,
        muted: false,
        createdAt: earning.created_at,
      });
    }

    return items
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
        <div className="mt-3">
          <Button variant="primary" size="sm" fullWidth onClick={shareLink} disabled={!cabinetLink}>
            {t('simple.referral.shareButton')}
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
                    item.muted ? (
                      <span className="text-dark-500">{item.value}</span>
                    ) : (
                      <span className={item.positive ? 'text-success-400' : undefined}>
                        +{item.value}
                      </span>
                    )
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
