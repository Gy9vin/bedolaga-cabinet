import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { subscriptionApi } from '../api/subscription';
import { resolveConnectionUrlForUi } from '../utils/connectionLink';
import { copyToClipboard } from '../utils/clipboard';

/**
 * Ссылка подключения и её кнопки («Показать QR», «Скопировать ссылку»,
 * переход на /connection) — общая логика для SimpleDashboard и
 * SimplePaymentSuccess (экран «Готово» после пополнения, разрыв 4). Раньше
 * жила только в SimpleDashboard — вынесена сюда, чтобы второй экран не
 * копировал тот же запрос и резолвер ссылки заново.
 */
export function useSubscriptionConnection(enabled: boolean) {
  const navigate = useNavigate();

  const { data: connectionLink } = useQuery({
    queryKey: ['connectionLink', undefined],
    queryFn: () => subscriptionApi.getConnectionLink(),
    enabled,
    retry: false,
  });

  const connectionUrl = useMemo(() => {
    if (!connectionLink) return null;
    return resolveConnectionUrlForUi({
      mode: connectionLink.connect_mode,
      subscriptionUrl: connectionLink.subscription_url,
      displayLink: connectionLink.display_link,
      happSchemeLink: connectionLink.happ_scheme_link,
      happCryptLink: connectionLink.happ_cryptolink,
      happCryptoLink: connectionLink.happ_crypto_link,
      happLink: connectionLink.happ_link,
    });
  }, [connectionLink]);

  const handleCopyLink = () => {
    if (connectionUrl) {
      void copyToClipboard(connectionUrl);
    }
  };

  const handleShowQr = () => {
    navigate('/connection/qr', {
      state: { url: connectionUrl, hideLink: connectionLink?.hide_link ?? false },
    });
  };

  return { connectionLink, connectionUrl, handleCopyLink, handleShowQr };
}
