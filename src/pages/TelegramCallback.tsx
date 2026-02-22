import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import { authApi } from '../api/auth';

// SessionStorage key to distinguish login vs link flow
const TELEGRAM_FLOW_KEY = 'telegram_flow';

export function setTelegramLinkFlow(): void {
  sessionStorage.setItem(TELEGRAM_FLOW_KEY, 'link');
}

function getAndClearTelegramFlow(): 'login' | 'link' {
  const flow = sessionStorage.getItem(TELEGRAM_FLOW_KEY);
  sessionStorage.removeItem(TELEGRAM_FLOW_KEY);
  return flow === 'link' ? 'link' : 'login';
}

export default function TelegramCallback() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  const { loginWithTelegramWidget, isAuthenticated } = useAuthStore();

  useEffect(() => {
    const authenticate = async () => {
      // Get auth data from URL params
      const id = searchParams.get('id');
      const firstName = searchParams.get('first_name');
      const lastName = searchParams.get('last_name');
      const username = searchParams.get('username');
      const photoUrl = searchParams.get('photo_url');
      const authDate = searchParams.get('auth_date');
      const hash = searchParams.get('hash');

      // Validate required fields
      if (!id || !firstName || !authDate || !hash) {
        setError(t('auth.telegramRequired'));
        return;
      }

      // Parse and validate numeric fields
      const parsedId = parseInt(id, 10);
      const parsedAuthDate = parseInt(authDate, 10);

      if (Number.isNaN(parsedId) || Number.isNaN(parsedAuthDate)) {
        setError(t('auth.telegramRequired'));
        return;
      }

      const flow = getAndClearTelegramFlow();

      if (flow === 'link') {
        // Account linking flow — user is already authenticated
        try {
          // Build initData-like string from widget params for the link endpoint
          // The backend link endpoint uses Telegram Widget validation
          const widgetData: Record<string, string> = {
            id,
            first_name: firstName,
            auth_date: authDate,
            hash,
          };
          if (lastName) widgetData.last_name = lastName;
          if (username) widgetData.username = username;
          if (photoUrl) widgetData.photo_url = photoUrl;

          await authApi.linkTelegramWidget(widgetData);
          navigate('/profile', { replace: true, state: { linkSuccess: 'telegram' } });
        } catch (err: unknown) {
          const error = err as { response?: { data?: { detail?: string } } };
          setError(
            error.response?.data?.detail ||
              t('profile.connections.error', 'Account linking failed'),
          );
        }
        return;
      }

      // Login flow
      if (isAuthenticated) {
        navigate('/');
        return;
      }

      try {
        await loginWithTelegramWidget({
          id: parsedId,
          first_name: firstName,
          last_name: lastName || undefined,
          username: username || undefined,
          photo_url: photoUrl || undefined,
          auth_date: parsedAuthDate,
          hash: hash,
        });
        navigate('/');
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } } };
        setError(error.response?.data?.detail || t('common.error'));
      }
    };

    authenticate();
  }, [searchParams, loginWithTelegramWidget, navigate, isAuthenticated, t]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950" />
        <div className="relative w-full max-w-md text-center">
          <div className="card">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-500/20">
              <svg
                className="h-8 w-8 text-error-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-dark-50">{t('auth.loginFailed')}</h2>
            <p className="mb-6 text-sm text-dark-400">{error}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="btn-primary w-full"
            >
              {t('auth.backToLogin', 'Back to login')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="fixed inset-0 bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950" />
      <div className="relative text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
        <h2 className="text-lg font-semibold text-dark-50">{t('auth.authenticating')}</h2>
        <p className="mt-2 text-sm text-dark-400">{t('common.loading')}</p>
      </div>
    </div>
  );
}
