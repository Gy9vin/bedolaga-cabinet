import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { brandingApi, type TelegramWidgetConfig } from '../api/branding';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/auth';
import { useNavigate } from 'react-router';

interface TelegramLoginButtonProps {
  referralCode?: string;
}

const SCRIPT_LOAD_TIMEOUT_MS = 8000;
const DEEPLINK_POLL_INTERVAL_MS = 2500;

export default function TelegramLoginButton({ referralCode }: TelegramLoginButtonProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [oidcLoading, setOidcLoading] = useState(false);
  const [oidcError, setOidcError] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);
  const loginWithTelegramOIDC = useAuthStore((s) => s.loginWithTelegramOIDC);

  // Deep link auth state
  const [deepLinkToken, setDeepLinkToken] = useState<string | null>(null);
  const [deepLinkBotUsername, setDeepLinkBotUsername] = useState<string>('');
  const [deepLinkPolling, setDeepLinkPolling] = useState(false);
  const [deepLinkError, setDeepLinkError] = useState('');
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const expireTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const loginWithDeepLink = useAuthStore((s) => s.loginWithDeepLink);

  const { data: widgetConfig } = useQuery<TelegramWidgetConfig>({
    queryKey: ['telegram-widget-config'],
    queryFn: brandingApi.getTelegramWidgetConfig,
    staleTime: 60000,
  });

  const botUsername =
    widgetConfig?.bot_username || import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '';
  const isOIDC = Boolean(widgetConfig?.oidc_enabled && widgetConfig?.oidc_client_id);

  // OIDC callback handler
  const handleOIDCCallbackRef =
    useRef<(data: { id_token?: string; error?: string }) => void>(undefined);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cleanup polling and expire timeout on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (expireTimeoutRef.current) {
        clearTimeout(expireTimeoutRef.current);
      }
    };
  }, []);

  handleOIDCCallbackRef.current = async (data: { id_token?: string; error?: string }) => {
    if (!mountedRef.current) return;
    if (data.error || !data.id_token) {
      setOidcError(data.error || t('auth.loginFailed'));
      setOidcLoading(false);
      return;
    }
    try {
      setOidcLoading(true);
      setOidcError('');
      await loginWithTelegramOIDC(data.id_token);
      if (mountedRef.current) navigate('/');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      let message = t('common.error');
      if (isAxiosError(err) && err.response?.data?.detail) {
        message = err.response.data.detail;
      }
      setOidcError(message);
    } finally {
      if (mountedRef.current) setOidcLoading(false);
    }
  };

  // Handle script load failure (timeout or error)
  const handleScriptFailed = useCallback(() => {
    if (!mountedRef.current || scriptLoaded) return;
    setScriptFailed(true);
    setOidcError('');
  }, [scriptLoaded]);

  // Load OIDC script with timeout
  useEffect(() => {
    if (!isOIDC || !widgetConfig?.oidc_client_id) return;

    const scriptId = 'telegram-login-oidc-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initTelegramLogin = () => {
      if (window.Telegram?.Login) {
        window.Telegram.Login.init(
          {
            client_id: Number(widgetConfig.oidc_client_id) || widgetConfig.oidc_client_id,
            request_access: widgetConfig.request_access ? ['write'] : undefined,
            lang: document.documentElement.lang || 'en',
          },
          (data) => handleOIDCCallbackRef.current?.(data),
        );
      }
    };

    // Set up timeout
    const timeoutId = setTimeout(() => {
      if (!scriptLoaded) {
        handleScriptFailed();
      }
    }, SCRIPT_LOAD_TIMEOUT_MS);

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://oauth.telegram.org/js/telegram-login.js?3';
      script.async = true;
      script.onload = () => {
        clearTimeout(timeoutId);
        setScriptLoaded(true);
        initTelegramLogin();
      };
      script.onerror = () => {
        clearTimeout(timeoutId);
        handleScriptFailed();
      };
      document.head.appendChild(script);
    } else {
      clearTimeout(timeoutId);
      setScriptLoaded(true);
      initTelegramLogin();
    }

    return () => clearTimeout(timeoutId);
  }, [
    isOIDC,
    widgetConfig?.oidc_client_id,
    widgetConfig?.request_access,
    t,
    scriptLoaded,
    handleScriptFailed,
  ]);

  // Legacy widget effect with timeout
  const loginWithTelegramWidget = useAuthStore((s) => s.loginWithTelegramWidget);

  useEffect(() => {
    if (isOIDC || !containerRef.current || !botUsername || !widgetConfig) return;

    const container = containerRef.current;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const callbackName = '__onTelegramWidgetAuth';
    (window as unknown as Record<string, unknown>)[callbackName] = async (
      user: Record<string, unknown>,
    ) => {
      try {
        await loginWithTelegramWidget({
          id: user.id as number,
          first_name: user.first_name as string,
          last_name: (user.last_name as string) || undefined,
          username: (user.username as string) || undefined,
          photo_url: (user.photo_url as string) || undefined,
          auth_date: user.auth_date as number,
          hash: user.hash as string,
        });
        navigate('/');
      } catch {
        // Error handled by auth store
      }
    };

    const script = document.createElement('script');
    script.src = '/js/telegram-widget.js';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', widgetConfig.size);
    script.setAttribute('data-radius', String(widgetConfig.radius));
    script.setAttribute('data-userpic', String(widgetConfig.userpic));
    script.setAttribute('data-onauth', `${callbackName}(user)`);
    if (widgetConfig.request_access) {
      script.setAttribute('data-request-access', 'write');
    }
    script.async = true;

    // Timeout for legacy widget
    const timeoutId = setTimeout(() => {
      // If container still has no iframe child (widget didn't render), mark as failed
      if (container && !container.querySelector('iframe')) {
        handleScriptFailed();
      }
    }, SCRIPT_LOAD_TIMEOUT_MS);

    script.onerror = () => {
      clearTimeout(timeoutId);
      handleScriptFailed();
    };

    container.appendChild(script);

    return () => {
      clearTimeout(timeoutId);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [isOIDC, botUsername, widgetConfig, loginWithTelegramWidget, navigate, handleScriptFailed]);

  // Deep link auth: request token and start polling with recursive setTimeout
  const startDeepLinkAuth = useCallback(async () => {
    setDeepLinkError('');

    // Clear any previous timers
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (expireTimeoutRef.current) {
      clearTimeout(expireTimeoutRef.current);
      expireTimeoutRef.current = null;
    }

    try {
      const response = await authApi.requestDeepLinkToken();
      const { token, bot_username, expires_in } = response;
      setDeepLinkToken(token);
      setDeepLinkBotUsername(bot_username || botUsername);
      setDeepLinkPolling(true);

      // Recursive setTimeout prevents overlapping async calls
      const poll = async () => {
        if (!mountedRef.current) return;
        try {
          await loginWithDeepLink(token);
          // Success — auth store is updated, navigate
          if (expireTimeoutRef.current) {
            clearTimeout(expireTimeoutRef.current);
            expireTimeoutRef.current = null;
          }
          if (mountedRef.current) {
            setDeepLinkPolling(false);
            navigate('/');
          }
        } catch (err: unknown) {
          if (!mountedRef.current) return;
          if (isAxiosError(err)) {
            if (err.response?.status === 202) {
              // Still pending — schedule next poll
              pollTimeoutRef.current = setTimeout(poll, DEEPLINK_POLL_INTERVAL_MS);
              return;
            }
            if (err.response?.status === 410) {
              // Token expired
              setDeepLinkPolling(false);
              setDeepLinkToken(null);
              setDeepLinkError(t('auth.deepLinkExpired'));
              return;
            }
          }
          // Other error — stop polling
          setDeepLinkPolling(false);
          setDeepLinkError(t('common.error'));
        }
      };

      // Start first poll
      pollTimeoutRef.current = setTimeout(poll, DEEPLINK_POLL_INTERVAL_MS);

      // Auto-expire after server-provided TTL
      expireTimeoutRef.current = setTimeout(
        () => {
          if (pollTimeoutRef.current) {
            clearTimeout(pollTimeoutRef.current);
            pollTimeoutRef.current = null;
          }
          if (mountedRef.current && !useAuthStore.getState().isAuthenticated) {
            setDeepLinkPolling(false);
            setDeepLinkToken(null);
            setDeepLinkError(t('auth.deepLinkExpired'));
          }
        },
        (expires_in || 300) * 1000,
      );
    } catch {
      setDeepLinkError(t('common.error'));
    }
  }, [botUsername, loginWithDeepLink, navigate, t]);

  // Auto-start deep link auth when script fails (with cancellation for Strict Mode)
  useEffect(() => {
    if (scriptFailed && !deepLinkToken && !deepLinkPolling) {
      let cancelled = false;
      const start = async () => {
        if (!cancelled) await startDeepLinkAuth();
      };
      start();
      return () => {
        cancelled = true;
      };
    }
  }, [scriptFailed, deepLinkToken, deepLinkPolling, startDeepLinkAuth]);

  if (!botUsername || botUsername === 'your_bot') {
    return (
      <div className="py-4 text-center text-sm text-gray-500">
        {t('auth.telegramNotConfigured')}
      </div>
    );
  }

  // Deep link fallback UI
  if (scriptFailed) {
    const deepLinkUrl = deepLinkToken
      ? `https://t.me/${deepLinkBotUsername || botUsername}?start=webauth_${deepLinkToken}`
      : '';

    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="flex flex-col items-center space-y-3">
          {/* Info message */}
          <p className="max-w-xs text-center text-xs text-dark-400">
            {t('auth.telegramWidgetBlocked')}
          </p>

          {deepLinkToken && deepLinkUrl ? (
            <>
              {/* Deep link button */}
              <a
                href={deepLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-[#54a9eb] px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4a96d2]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                {t('auth.openBotToLogin')}
              </a>

              {/* Polling status */}
              {deepLinkPolling && (
                <div className="flex items-center gap-2 text-xs text-dark-400">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                  {t('auth.waitingForConfirmation')}
                </div>
              )}
            </>
          ) : deepLinkError ? (
            <div className="flex flex-col items-center space-y-2">
              <p className="text-xs text-red-500">{deepLinkError}</p>
              <button
                type="button"
                onClick={startDeepLinkAuth}
                className="text-sm text-accent-400 transition-colors hover:text-accent-300"
              >
                {t('auth.tryAgain')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-dark-400">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
              {t('common.loading')}
            </div>
          )}
        </div>

        {/* Bot link fallback */}
        <div className="text-center">
          <p className="mb-2 text-xs text-dark-500">{t('auth.orOpenInApp')}</p>
          <a
            href={
              referralCode
                ? `https://t.me/${botUsername}?start=${encodeURIComponent(referralCode)}`
                : `https://t.me/${botUsername}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-telegram-blue inline-flex items-center text-sm hover:underline"
          >
            <svg className="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            @{botUsername}
          </a>
        </div>
      </div>
    );
  }

  // Normal widget UI (when script loads successfully)
  return (
    <div className="flex flex-col items-center space-y-4">
      {isOIDC ? (
        <div className="flex flex-col items-center space-y-2">
          <button
            type="button"
            onClick={() => {
              setOidcError('');
              setOidcLoading(true);
              if (window.Telegram?.Login) {
                window.Telegram.Login.open();
              } else {
                setOidcLoading(false);
              }
            }}
            disabled={oidcLoading || !scriptLoaded}
            className="inline-flex items-center gap-2 rounded-lg bg-[#54a9eb] px-6 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#4a96d2] disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            {oidcLoading ? t('common.loading') : t('auth.loginWithTelegram')}
          </button>
          {oidcError && <p className="text-xs text-red-500">{oidcError}</p>}
        </div>
      ) : (
        <div ref={containerRef} className="flex justify-center" />
      )}

      <div className="text-center">
        <p className="mb-2 text-xs text-gray-500">{t('auth.orOpenInApp')}</p>
        <a
          href={
            referralCode
              ? `https://t.me/${botUsername}?start=${encodeURIComponent(referralCode)}`
              : `https://t.me/${botUsername}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-telegram-blue inline-flex items-center text-sm hover:underline"
        >
          <svg className="mr-1 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          @{botUsername}
        </a>
      </div>
    </div>
  );
}
