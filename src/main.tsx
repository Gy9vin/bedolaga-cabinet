import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  init,
  restoreInitData,
  mountMiniApp,
  miniAppReady,
  mountThemeParams,
  mountViewport,
  expandViewport,
  mountSwipeBehavior,
  disableVerticalSwipes,
  mountClosingBehavior,
  disableClosingConfirmation,
  mountBackButton,
  mountMainButton,
  bindThemeParamsCssVars,
  bindViewportCssVars,
} from '@telegram-apps/sdk-react';
import { AppWithNavigator } from './AppWithNavigator';
import { initLogoPreload } from './api/branding';
import { getCachedFullscreenEnabled, isTelegramMobile } from './hooks/useTelegramSDK';
import './i18n';
import './styles/globals.css';

// Initialize Telegram SDK v3
try {
  init();
  restoreInitData();

  mountMiniApp();
  mountThemeParams();
  bindThemeParamsCssVars();
  mountSwipeBehavior();
  disableVerticalSwipes();
  mountClosingBehavior();
  disableClosingConfirmation();
  mountBackButton();
  mountMainButton();

  mountViewport()
    .then(() => {
      bindViewportCssVars();
      expandViewport();
    })
    .catch(() => {});

  miniAppReady();

  // Auto-enter fullscreen if enabled in settings (mobile only)
  if (getCachedFullscreenEnabled() && isTelegramMobile()) {
    import('@telegram-apps/sdk-react').then(({ requestFullscreen, isFullscreen }) => {
      setTimeout(() => {
        if (!isFullscreen()) {
          requestFullscreen();
        }
      }, 100);
    });
  }
} catch {
  // Not in Telegram — ok
}

// Preload logo from cache immediately on page load
initLogoPreload();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppWithNavigator />
    </QueryClientProvider>
  </React.StrictMode>,
);
