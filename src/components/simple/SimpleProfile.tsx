import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import SimpleScreen from './SimpleScreen';
import SimpleRow from './SimpleRow';
import SimpleGroup from './SimpleGroup';
import { Switch } from '@/components/primitives/Switch';
import { BentoCard } from '@/components/ui/BentoCard';
import { useAuthStore } from '../../store/auth';
import { useUiMode } from '@/hooks/useUiMode';
import { authApi } from '../../api/auth';
import { notificationsApi } from '../../api/notifications';
import { infoApi } from '../../api/info';
import { displayName } from '../../utils/displayName';

const PROVIDER_LABEL_KEYS: Record<string, string> = {
  telegram: 'simple.profile.providerTelegram',
  email: 'simple.profile.providerEmail',
  yandex: 'simple.profile.providerYandex',
  google: 'simple.profile.providerGoogle',
  discord: 'simple.profile.providerDiscord',
  vk: 'simple.profile.providerVk',
};

/**
 * Экран «Профиль» простого режима: карточка пользователя, способы входа
 * (переход к управлению — на /profile/accounts), настройки и выход.
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
  const user = useAuthStore((s) => s.user);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const logout = useAuthStore((s) => s.logout);
  const { isSimple, setMode, isSaving } = useUiMode();

  const [showLangPicker, setShowLangPicker] = useState(false);

  const { data: linkedProvidersData } = useQuery({
    queryKey: ['linked-providers'],
    queryFn: () => authApi.getLinkedProviders(),
  });
  const providers = linkedProvidersData?.providers ?? [];

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
            {providers.map((provider) => (
              <SimpleRow
                key={provider.provider}
                title={t(PROVIDER_LABEL_KEYS[provider.provider] ?? '', provider.provider)}
                subtitle={
                  provider.linked
                    ? (provider.identifier ?? undefined)
                    : t('simple.profile.providerNotLinked')
                }
                value={
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      provider.linked
                        ? 'bg-success-500/10 text-success-400'
                        : 'bg-accent-500/10 text-accent-400'
                    }`}
                  >
                    {provider.linked
                      ? t('simple.profile.providerLinked')
                      : t('simple.profile.providerLink')}
                  </span>
                }
                onClick={() => navigate('/profile/accounts')}
                chevron
              />
            ))}
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
