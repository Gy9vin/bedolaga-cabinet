import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import SimpleRow from './SimpleRow';
import SimpleGroup from './SimpleGroup';
import { Switch } from '@/components/primitives/Switch';
import { BentoCard } from '@/components/ui/BentoCard';
import { usePlatform, useIsTelegram } from '@/platform/hooks/usePlatform';
import { useAuthStore } from '../../store/auth';
import { useUiMode } from '@/hooks/useUiMode';
import { authApi } from '../../api/auth';
import { notificationsApi } from '../../api/notifications';
import { infoApi } from '../../api/info';
import { displayName } from '../../utils/displayName';
import { useToast } from '../Toast';
import { getErrorDetail, LINK_OAUTH_STATE_KEY, LINK_OAUTH_PROVIDER_KEY } from '../../utils/oauth';
import { getTelegramInitData } from '../../hooks/useTelegramSDK';
import type { LinkedProvider } from '../../types';

const PROVIDER_LABEL_KEYS: Record<string, string> = {
  telegram: 'simple.profile.providerTelegram',
  email: 'simple.profile.providerEmail',
  yandex: 'simple.profile.providerYandex',
  google: 'simple.profile.providerGoogle',
  discord: 'simple.profile.providerDiscord',
  vk: 'simple.profile.providerVk',
};

const OAUTH_PROVIDERS = ['google', 'yandex', 'discord', 'vk'];
const isOAuthProvider = (provider: string): boolean => OAUTH_PROVIDERS.includes(provider);

/**
 * Экран «Профиль» простого режима: карточка пользователя, способы входа
 * (прямые действия «Привязать»/«Отвязать» здесь же, без ухода на
 * /profile/accounts — находка 4 сверки с макетом), настройки и выход.
 *
 * Отвязка провайдера доступна только когда у человека больше одного
 * способа входа (`canUnlink`, тот же инвариант, что и в ConnectedAccounts):
 * иначе он потеряет доступ к аккаунту. Telegram по этому же правилу
 * никогда не отвязать (не OAuth и не email) — в макете у него только
 * статус, без действия.
 *
 * КРИТИЧЕСКИЙ ИНВАРИАНТ: тумблер «Простой интерфейс» не должен зависеть от
 * загрузки чего-либо ещё. В волне 1 (обычный Profile.tsx) он уже пострадал
 * от этого — оказался внутри ветки, зависящей от настроек уведомлений, и
 * пропадал вместе с ними при ошибке запроса, запирая человека в простом
 * режиме без выхода. Здесь `useUiMode()` и его рендер полностью независимы
 * от notificationSettings.
 */
export default function SimpleProfile() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const inTelegram = useIsTelegram();
  const platform = usePlatform();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const logout = useAuthStore((s) => s.logout);
  const { isSimple, setMode, isSaving } = useUiMode();

  const [showLangPicker, setShowLangPicker] = useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = useState<string | null>(null);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);

  const { data: linkedProvidersData } = useQuery({
    queryKey: ['linked-providers'],
    queryFn: () => authApi.getLinkedProviders(),
  });
  const providers = linkedProvidersData?.providers ?? [];

  const canUnlink = (provider: LinkedProvider): boolean => {
    if (!provider.linked) return false;
    if (!isOAuthProvider(provider.provider) && provider.provider !== 'email') return false;
    const linkedCount = providers.filter((p) => p.linked).length;
    return linkedCount > 1;
  };

  const unlinkMutation = useMutation({
    mutationFn: (provider: string) => authApi.unlinkProvider(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linked-providers'] });
      showToast({ type: 'success', message: t('profile.accounts.unlinkSuccess') });
    },
    onError: () => {
      showToast({ type: 'error', message: t('profile.accounts.unlinkError') });
    },
    onSettled: () => setConfirmingUnlink(null),
  });

  const handleUnlink = (provider: string) => {
    if (confirmingUnlink === provider) {
      setConfirmingUnlink(null);
      unlinkMutation.mutate(provider);
    } else {
      setConfirmingUnlink(provider);
    }
  };

  // OAuth-провайдер: тот же флоу, что и на /profile/accounts — инициируем
  // редирект и уходим в браузер (Mini App) или в текущей вкладке.
  const handleLinkOAuth = async (provider: string) => {
    if (linkingProvider) return;
    setLinkingProvider(provider);
    try {
      const { authorize_url, state } = await authApi.linkProviderInit(provider);
      if (!authorize_url || !state) {
        throw new Error('Invalid response from server');
      }
      let parsed: URL;
      try {
        parsed = new URL(authorize_url);
      } catch {
        throw new Error('Invalid OAuth redirect URL');
      }
      if (parsed.protocol !== 'https:') {
        throw new Error('Invalid OAuth redirect URL');
      }

      if (inTelegram) {
        platform.openLink(authorize_url);
        setLinkingProvider(null);
        showToast({ type: 'info', message: t('profile.accounts.continueInBrowser') });
      } else {
        sessionStorage.setItem(LINK_OAUTH_STATE_KEY, state);
        sessionStorage.setItem(LINK_OAUTH_PROVIDER_KEY, provider);
        window.location.href = authorize_url;
      }
    } catch (err: unknown) {
      showToast({ type: 'error', message: getErrorDetail(err) || t('profile.accounts.linkError') });
      setLinkingProvider(null);
    }
  };

  // Telegram в Mini App привязывается одной кнопкой через initData. В
  // браузере нужен виджет входа Telegram (скрипт + iframe) — тяжеловат для
  // строки простого профиля, уводим на полный экран управления входом, где
  // он уже есть.
  const handleLinkTelegram = async () => {
    if (linkingProvider) return;
    const initData = getTelegramInitData();
    if (!initData) {
      navigate('/profile/accounts');
      return;
    }
    setLinkingProvider('telegram');
    try {
      const response = await authApi.linkTelegram({ init_data: initData });
      if (response.merge_required && response.merge_token) {
        navigate(`/merge/${response.merge_token}`, { replace: true });
      } else {
        queryClient.invalidateQueries({ queryKey: ['linked-providers'] });
        showToast({ type: 'success', message: t('profile.accounts.linkSuccess') });
      }
    } catch (err: unknown) {
      showToast({ type: 'error', message: getErrorDetail(err) || t('profile.accounts.linkError') });
    } finally {
      setLinkingProvider(null);
    }
  };

  // Почта требует формы регистрации (пароль) — она уже есть на полном
  // экране управления входом, здесь её не дублируем.
  const handleLink = (provider: string) => {
    if (provider === 'telegram') {
      handleLinkTelegram();
    } else if (provider === 'email') {
      navigate('/profile/accounts');
    } else {
      handleLinkOAuth(provider);
    }
  };

  const { data: notificationSettings } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: notificationsApi.getSettings,
    retry: false,
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: notificationsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });

  const { data: languagesData } = useQuery({
    queryKey: ['languages'],
    queryFn: infoApi.getLanguages,
    staleTime: 60000,
  });
  const languages = languagesData?.languages ?? [];
  const currentLanguage = languages.find((l) => l.code === i18n.language) || languages[0] || null;

  const initials =
    displayName(user)
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';

  const idLine = [
    user?.username ? `@${user.username}` : null,
    user?.telegram_id ? t('simple.profile.idLabel', { id: user.telegram_id }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    setShowLangPicker(false);
  };

  return (
    <SimpleScreen title={t('simple.profile.title')}>
      <BentoCard className="flex items-center gap-3.5">
        <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-full border border-accent-500/40 bg-accent-500/10 text-base font-bold text-accent-400">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-dark-50">
            {displayName(user) || t('simple.profile.unnamed')}
          </p>
          {idLine && <p className="mt-0.5 text-sm text-dark-400">{idLine}</p>}
        </div>
      </BentoCard>

      {providers.length > 0 && (
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
            {t('simple.profile.loginMethodsLabel')}
          </span>
          <SimpleGroup className="mt-2">
            {providers.map((provider) => {
              const isLinkable =
                isOAuthProvider(provider.provider) ||
                provider.provider === 'telegram' ||
                provider.provider === 'email';

              let action: ReactNode = (
                <span className="rounded-full bg-success-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success-400">
                  {t('simple.profile.providerLinked')}
                </span>
              );

              if (provider.linked && canUnlink(provider)) {
                const confirming = confirmingUnlink === provider.provider;
                action = (
                  <button
                    type="button"
                    onClick={() => handleUnlink(provider.provider)}
                    disabled={unlinkMutation.isPending}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      confirming
                        ? 'bg-error-500 text-white'
                        : 'border border-dark-700/50 text-error-400'
                    }`}
                  >
                    {confirming ? t('simple.profile.unlinkConfirm') : t('simple.profile.unlink')}
                  </button>
                );
              } else if (!provider.linked && isLinkable) {
                action = (
                  <button
                    type="button"
                    onClick={() => handleLink(provider.provider)}
                    disabled={linkingProvider !== null}
                    className="shrink-0 rounded-lg bg-accent-500/10 px-2.5 py-1 text-xs font-semibold text-accent-400 disabled:opacity-50"
                  >
                    {t('simple.profile.providerLink')}
                  </button>
                );
              } else if (!provider.linked) {
                action = undefined;
              }

              return (
                <SimpleRow
                  key={provider.provider}
                  title={t(PROVIDER_LABEL_KEYS[provider.provider] ?? '', provider.provider)}
                  subtitle={
                    provider.linked
                      ? (provider.identifier ?? undefined)
                      : t('simple.profile.providerNotLinked')
                  }
                  value={action}
                />
              );
            })}
          </SimpleGroup>
        </div>
      )}

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-dark-50/40">
          {t('simple.profile.settingsLabel')}
        </span>
        <SimpleGroup className="mt-2">
          {/* Тумблер режима — не гейтится ни одним из запросов ниже. */}
          <SimpleRow
            title={t('simple.profile.uiModeTitle')}
            subtitle={
              isSaving ? t('simple.profile.uiModeSaving') : t('simple.profile.uiModeSubtitle')
            }
            value={
              <Switch
                checked={isSimple}
                disabled={isSaving}
                onCheckedChange={(checked) => setMode(checked ? 'simple' : 'advanced')}
              />
            }
          />

          {notificationSettings && (
            <SimpleRow
              title={t('simple.profile.notificationsTitle')}
              subtitle={t('simple.profile.notificationsSubtitle')}
              value={
                <Switch
                  checked={notificationSettings.subscription_expiry_enabled}
                  disabled={updateNotificationsMutation.isPending}
                  onCheckedChange={(checked) =>
                    updateNotificationsMutation.mutate({ subscription_expiry_enabled: checked })
                  }
                />
              }
            />
          )}

          <SimpleRow
            title={t('simple.profile.languageTitle')}
            value={currentLanguage?.name ?? i18n.language.toUpperCase()}
            onClick={languages.length > 1 ? () => setShowLangPicker((v) => !v) : undefined}
            chevron={languages.length > 1}
          />
        </SimpleGroup>

        {showLangPicker && languages.length > 1 && (
          <div className="mt-2 divide-y divide-dark-700/40 rounded-2xl border border-dark-700/40">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => changeLanguage(lang.code)}
                className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm ${
                  lang.code === i18n.language ? 'text-accent-400' : 'text-dark-200'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <SimpleGroup>
        {isAdmin && (
          <SimpleRow
            title={t('simple.profile.adminPanelTitle')}
            subtitle={t('simple.profile.adminPanelSubtitle')}
            value={
              <span className="rounded-full bg-warning-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warning-400">
                {t('simple.profile.adminBadge')}
              </span>
            }
            onClick={() => navigate('/admin')}
            chevron
          />
        )}
        <SimpleRow
          title={t('simple.profile.supportTitle')}
          subtitle={t('simple.profile.supportSubtitle')}
          onClick={() => navigate('/support')}
          chevron
        />
        <SimpleRow title={t('simple.profile.logout')} onClick={() => logout()} danger />
      </SimpleGroup>
    </SimpleScreen>
  );
}
