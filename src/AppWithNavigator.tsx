import { useEffect } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import {
  showBackButton,
  hideBackButton,
  onBackButtonClick,
  offBackButtonClick,
} from '@telegram-apps/sdk-react';
import App from './App';
import { PlatformProvider } from './platform/PlatformProvider';
import { ThemeColorsProvider } from './providers/ThemeColorsProvider';
import { WebSocketProvider } from './providers/WebSocketProvider';
import { ToastProvider } from './components/Toast';
import { TooltipProvider } from './components/primitives/Tooltip';
import { isInTelegramWebApp } from './hooks/useTelegramSDK';

/**
 * Manages Telegram BackButton visibility based on navigation location.
 * Shows back button on non-root routes, hides on root.
 */
function TelegramBackButton() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isRoot = location.pathname === '/' || location.pathname === '';
    try {
      if (isRoot) {
        hideBackButton();
      } else {
        showBackButton();
      }
    } catch {
      // Not in Telegram or back button not mounted
    }
  }, [location]);

  useEffect(() => {
    const handler = () => navigate(-1);
    try {
      onBackButtonClick(handler);
    } catch {
      // Not in Telegram
    }
    return () => {
      try {
        offBackButtonClick(handler);
      } catch {
        // Not in Telegram
      }
    };
  }, [navigate]);

  return null;
}

export function AppWithNavigator() {
  const isTelegram = isInTelegramWebApp();

  return (
    <BrowserRouter>
      {isTelegram && <TelegramBackButton />}
      <PlatformProvider>
        <ThemeColorsProvider>
          <TooltipProvider>
            <ToastProvider>
              <WebSocketProvider>
                <App />
              </WebSocketProvider>
            </ToastProvider>
          </TooltipProvider>
        </ThemeColorsProvider>
      </PlatformProvider>
    </BrowserRouter>
  );
}
