# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Подробный индекс. Если ответ есть здесь — **не grep'айте**. Добавили новый модуль/страницу/стор — допишите сюда.

---

## 0. TL;DR

Bedolaga Cabinet — веб-интерфейс личного кабинета для VPN-бота [Remnawave Bedolaga Telegram Bot](https://github.com/BEDOLAGA-DEV/remnawave-bedolaga-telegram-bot). Одна сборка работает и как Telegram Mini App, и как обычный SPA в браузере. Backend API проксируется через `/api/*`.

Stack: **React 19 + Vite 7 + TypeScript 5 + Tailwind 3 + Radix UI + Zustand + @tanstack/react-query + react-router 7 + i18next (ru/en/fa/zh) + framer-motion + Recharts + Tiptap**. Telegram SDK — `@telegram-apps/sdk-react`.

Релизы — release-please. Версия из `package.json` прокинута в bundle как `__APP_VERSION__` (см. `vite.config.ts`). `CHANGELOG.md` генерируется автоматически.

---

## 1. Commands

```bash
npm run dev          # Vite :5173, проксирует /api → http://localhost:8080 (вырезая /api)
npm run build        # tsc (полный type-check на emit) + vite build → dist/
npm run type-check   # tsc --noEmit
npm run preview      # Предпросмотр dist/
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run format       # prettier --write src/**/*.{ts,tsx,css,json}
npm run format:check # prettier --check
```

**Тестов нет.** Нет `npm test`, нет vitest/jest/playwright. Проверка = type-check + lint + ручной прогон в браузере и Telegram WebApp.

Husky + lint-staged (`.husky/pre-commit`): `eslint --fix` + `prettier --write` на staged `.ts/.tsx`, `prettier --write` на `.css/.json`. Не используйте `--no-verify` без явного запроса.

Docker: `docker compose up -d --build` — multi-stage (Node builder → Nginx :80), раздаёт `dist/`. См. `Dockerfile`, `docker-compose.yml`, `nginx.conf`.

---

## 2. Environment variables

Build-time (вшиваются в bundle, нужна пересборка):
| Переменная | Назначение | Дефолт |
|---|---|---|
| `VITE_API_URL` | URL к backend (обычно `/api`, либо полный `https://api.example.com/cabinet`) | `/api` |
| `VITE_TELEGRAM_BOT_USERNAME` | Username бота без `@` | — |
| `VITE_APP_NAME` | Название в шапке / title | `Cabinet` |
| `VITE_APP_LOGO` | Текст логотипа (1–2 символа) | `V` |

Runtime (только Docker): `CABINET_PORT`, дефолт 3020.

Backend (`.env` бота, **не здесь**): `CABINET_ENABLED=true`, `CABINET_JWT_SECRET`, `CABINET_ALLOWED_ORIGINS` (без домена — CORS), `CABINET_ACCESS_TOKEN_EXPIRE_MINUTES` (15), `CABINET_REFRESH_TOKEN_EXPIRE_DAYS` (7).

Path alias: `@/*` → `src/*` (`vite.config.ts`, `tsconfig.json`).

---

## 3. Provider stack

`src/main.tsx`:
1. `React.StrictMode`
2. `ErrorBoundary level="app"`
3. `QueryClientProvider` (retry: 1, без refetch on focus)
4. `AppWithNavigator`

`src/AppWithNavigator.tsx`:
5. `BrowserRouter`
6. `TelegramBackButton` (условный; вызывает `navigate(-1)` кроме bottom-nav-путей `/`, `/subscriptions`, `/balance`, `/referral`, `/support`, `/wheel`)
7. `ErrorBoundary level="page"`
8. `PlatformProvider` (см. §5)
9. `ThemeColorsProvider` (см. §7)
10. `TooltipProvider` (Radix)
11. `ToastProvider` (`src/components/Toast.tsx`)
12. `WebSocketProvider` (см. §6)
13. `Twemoji` (`react-twemoji`)
14. `<App />`

---

## 4. Route table (`src/App.tsx`, ~1316 строк)

**`lazyWithRetry(factory)`** (строки ~9–22) — обёртка над `React.lazy`: при ошибке загрузки чанка (новый деплой со старыми хэшами) один раз делает `window.location.reload()`, ставит timestamp в `sessionStorage['chunk_reload_ts']`, гуард 30 секунд от зацикливания. **Используйте её для всех новых страниц.** `Dashboard` импортирован НЕ лениво — LCP-критичен.

### Public / auth (без Layout, без защиты)
| Path | Component |
|---|---|
| `/login` | `Login` |
| `/auth/telegram/callback` | `TelegramCallback` |
| `/auth/telegram`, `/tg` | `TelegramRedirect` |
| `/connect`, `/add` | `DeepLinkRedirect` (запуск VPN-клиента по scheme) |
| `/auth/oauth/callback` | `OAuthCallback` |
| `/verify-email` | `VerifyEmail` |
| `/reset-password` | `ResetPassword` |
| `/merge/:mergeToken` | `MergeAccounts` |
| `/buy/success/:token` | `PurchaseSuccess` |
| `/buy/:slug` | `QuickPurchase` |
| `/auto-login` | `AutoLogin` |
| `*` | `<Navigate to="/" replace />` |

### User (`ProtectedRoute` + `Layout`)
| Path | Component | Заметки |
|---|---|---|
| `/` | `Dashboard` | eager load |
| `/subscriptions` | `Subscriptions` | |
| `/subscriptions/:subscriptionId` | `Subscription` | |
| `/subscriptions/:subscriptionId/renew` | `RenewSubscription` | |
| `/subscription/:subscriptionId` | `LegacySubscriptionRedirect` | legacy → `/subscriptions/...` |
| `/subscription` | `Subscriptions` | legacy |
| `/subscription/purchase` | `SubscriptionPurchase` | legacy |
| `/balance` | `Balance` | |
| `/balance/saved-cards` | `SavedCards` | |
| `/balance/top-up` | `TopUpMethodSelect` | шаг 1 |
| `/balance/top-up/:methodId` | `TopUpAmount` | шаг 2 |
| `/balance/top-up/result` | `TopUpResult` | `withLayout=false` |
| `/referral` | `Referral` | |
| `/referral/partner/apply` | `ReferralPartnerApply` | |
| `/referral/withdrawal/request` | `ReferralWithdrawalRequest` | |
| `/support` | `Support` | |
| `/profile` | `Profile` | |
| `/profile/accounts` | `ConnectedAccounts` | связанные OAuth-провайдеры |
| `/auth/link/telegram/callback` | `LinkTelegramCallback` | привязка Telegram к email-аккаунту |
| `/contests` | `Contests` | |
| `/polls` | `Polls` | |
| `/info` | `Info` | FAQ / rules / privacy / offer |
| `/wheel` | `Wheel` | |
| `/gift` | `GiftSubscription` | |
| `/gift/result` | `GiftResult` | |
| `/connection/qr` | `ConnectionQR` | |
| `/connection` | `Connection` | |
| `/news/:slug` | `NewsArticle` | |

### Admin (`AdminRoute` или `PermissionRoute permission="..."` + `AdminLayout`)

`AdminRoute` — пропускает если `isAdmin` из `useAuthStore`. `PermissionRoute` — если нужный код в `usePermissionStore` (wildcard `*:*`, `section:*`, см. §8).

| Path | Component | Permission |
|---|---|---|
| `/admin` | `AdminPanel` | `AdminRoute` |
| `/admin/tickets` | `AdminTickets` | `tickets:read` |
| `/admin/tickets/settings` | `AdminTicketSettings` | `tickets:settings` |
| `/admin/settings` | `AdminSettings` | `settings:read` |
| `/admin/apps` | `AdminApps` | `apps:read` |
| `/admin/wheel` | `AdminWheel` | `wheel:read` |
| `/admin/tariffs` | `AdminTariffs` | `tariffs:read` |
| `/admin/tariffs/create` | `AdminTariffCreate` | `tariffs:create` |
| `/admin/tariffs/:id/edit` | `AdminTariffCreate` | `tariffs:edit` |
| `/admin/landings` | `AdminLandings` | `landings:read` |
| `/admin/landings/create` | `AdminLandingEditor` | `landings:create` |
| `/admin/landings/:id/edit` | `AdminLandingEditor` | `landings:edit` |
| `/admin/landings/:id/stats` | `AdminLandingStats` | `landings:read` |
| `/admin/servers` | `AdminServers` | `servers:read` |
| `/admin/servers/:id/edit` | `AdminServerEdit` | `servers:edit` |
| `/admin/dashboard` | `AdminDashboard` | `stats:read` |
| `/admin/ban-system` | `AdminBanSystem` | `ban_system:read` |
| `/admin/broadcasts` | `AdminBroadcasts` | `broadcasts:read` |
| `/admin/broadcasts/create` | `AdminBroadcastCreate` | `broadcasts:create` |
| `/admin/broadcasts/:id` | `AdminBroadcastDetail` | `broadcasts:read` |
| `/admin/promocodes` | `AdminPromocodes` | `promocodes:read` |
| `/admin/promocodes/create` | `AdminPromocodeCreate` | `promocodes:create` |
| `/admin/promocodes/:id/edit` | `AdminPromocodeCreate` | `promocodes:edit` |
| `/admin/promocodes/:id/stats` | `AdminPromocodeStats` | `promocodes:read` |
| `/admin/promo-groups` | `AdminPromoGroups` | `promo_groups:read` |
| `/admin/promo-groups/create` | `AdminPromoGroupCreate` | `promo_groups:create` |
| `/admin/promo-groups/:id/edit` | `AdminPromoGroupCreate` | `promo_groups:edit` |
| `/admin/campaigns` | `AdminCampaigns` | `campaigns:read` |
| `/admin/campaigns/create` | `AdminCampaignCreate` | `campaigns:create` |
| `/admin/campaigns/:id/edit` | `AdminCampaignEdit` | `campaigns:edit` |
| `/admin/campaigns/:id/stats` | `AdminCampaignStats` | `campaigns:read` |
| `/admin/partners` | `AdminPartners` | `partners:read` |
| `/admin/partners/settings` | `AdminPartnerSettings` | |
| `/admin/partners/applications/:id/review` | `AdminApplicationReview` | |
| `/admin/partners/:userId/commission` | `AdminPartnerCommission` | |
| `/admin/partners/:userId/revoke` | `AdminPartnerRevoke` | |
| `/admin/partners/:userId/campaigns/assign` | `AdminPartnerCampaignAssign` | |
| `/admin/partners/:userId` | `AdminPartnerDetail` | |
| `/admin/withdrawals` | `AdminWithdrawals` | `withdrawals:read` |
| `/admin/withdrawals/:id` | `AdminWithdrawalDetail` | |
| `/admin/withdrawals/:id/reject` | `AdminWithdrawalReject` | |
| `/admin/users` | `AdminUsers` | `users:read` |
| `/admin/users/:id` | `AdminUserDetail` | |
| `/admin/payments` | `AdminPayments` | `payments:read` |
| `/admin/traffic-usage` | `AdminTrafficUsage` | `traffic:read` |
| `/admin/sales-stats` | `AdminSalesStats` | `sales_stats:read` |
| `/admin/referral-network` | `ReferralNetwork` (`pages/ReferralNetwork/`) | `stats:read` |
| `/admin/payment-methods` | `AdminPaymentMethods` | `payment_methods:read` |
| `/admin/payment-methods/:methodId/edit` | `AdminPaymentMethodEdit` | |
| `/admin/promo-offers` | `AdminPromoOffers` | `promo_offers:read` |
| `/admin/promo-offers/templates/:id/edit` | `AdminPromoOfferTemplateEdit` | |
| `/admin/promo-offers/send` | `AdminPromoOfferSend` | |
| `/admin/remnawave` | `AdminRemnawave` | `remnawave:read` |
| `/admin/remnawave/squads/:uuid` | `AdminRemnawaveSquadDetail` | |
| `/admin/email-templates` | `AdminEmailTemplates` | `email_templates:read` |
| `/admin/email-templates/preview/:type/:lang` | `AdminEmailTemplatePreview` | |
| `/admin/updates` | `AdminUpdates` | `updates:read` |
| `/admin/pinned-messages` | `AdminPinnedMessages` | `pinned_messages:read` |
| `/admin/pinned-messages/create` | `AdminPinnedMessageCreate` | |
| `/admin/pinned-messages/:id/edit` | `AdminPinnedMessageCreate` | |
| `/admin/channel-subscriptions` | `AdminChannelSubscriptions` | `channels:read` |
| `/admin/channel-subscriptions/:id/report` | `AdminChannelMembershipReport` | |
| `/admin/roles` | `AdminRoles` | `roles:read` |
| `/admin/roles/create` | `AdminRoleEdit` | `roles:create` |
| `/admin/roles/:id/edit` | `AdminRoleEdit` | `roles:edit` |
| `/admin/roles/assign` | `AdminRoleAssign` | `roles:assign` |
| `/admin/policies` | `AdminPolicies` | `roles:read` |
| `/admin/policies/create` | `AdminPolicyEdit` | `roles:create` |
| `/admin/policies/:id/edit` | `AdminPolicyEdit` | `roles:edit` |
| `/admin/news` | `AdminNews` | `news:read` |
| `/admin/news/create` | `AdminNewsCreate` | `news:create` |
| `/admin/news/:id/edit` | `AdminNewsCreate` | `news:edit` |
| `/admin/audit-log` | `AdminAuditLog` | `audit_log:read` |
| `/admin/happ` | `AdminHappManagement` | `admin` |

Добавляя админ-роут: `lazyWithRetry` → `PermissionRoute permission="..."` → внутри `AdminLayout`. Код permission должен существовать на backend.

---

## 5. Platform abstraction (`src/platform/`)

Одна кодовая база — два рантайма. **Всегда через хуки отсюда**, не `window.Telegram` / `alert()`.

**Файлы:**
- `PlatformProvider.tsx` — детектит окружение (`isInTelegramWebApp()` из `hooks/useTelegramSDK`), один раз через `useMemo` выбирает адаптер.
- `PlatformContext.tsx` — React context.
- `types.ts` — `PlatformCapabilities`, `BackButtonController`, `HapticController`, `DialogController`, `ThemeController`, `CloudStorageController`, `TelegramThemeParams`.
- `index.ts` — публичный экспорт.
- `adapters/TelegramAdapter.ts` — все capabilities `true`; `@telegram-apps/sdk-react` (`showPopup`, `hapticFeedbackImpactOccurred`, `setMiniAppHeaderColor`, `setMiniAppBottomBarColor`, `getCloudStorageItem`, `openInvoice`, `shareURL`).
- `adapters/WebAdapter.ts` — fallback: Vibration API если доступен, `alert`/`confirm`, `meta[name="theme-color"]`, `localStorage` с префиксом `bedolaga_`, `navigator.share` или clipboard, `window.open` для invoice/links.

**Хуки (`src/platform/hooks/`):**
| Хук | Результат |
|---|---|
| `usePlatform()` | `{ platform: 'telegram' \| 'web', capabilities, backButton, haptic, dialog, theme, cloudStorage, openInvoice, openLink, openTelegramLink, share, setClosingConfirmation }` |
| `useIsTelegram()` | `boolean` |
| `useCapability(key)` | `boolean` |
| `useHaptic()` | `{ impact(style?), notification(type), selection(), isAvailable }` |
| `useHapticClick(onClick?, style?)` | обёрнутый handler |
| `useHapticFeedback()` | именованные: `buttonPress`, `buttonPressHeavy`, `toggle`, `success`, `warning`, `error`, `selectionChanged`, `impact`, `notification`, `selection` |
| `useNativeDialog()` | `{ alert, confirm, popup, isNative }` |
| `useDestructiveConfirm()` | async; красная кнопка в Telegram |
| `PopupButtons` | фабрика: `.ok()`, `.cancel()`, `.close()`, `.destructive(id, text)`, `.default(id, text)` |
| `useNotify()` | `{ notify, success, error, warning, info }` — Telegram `popup`, web `Toast` |

**Capabilities (Web vs Telegram):**
| capability | Web | Telegram |
|---|---|---|
| `hasBackButton` | false | true |
| `hasHapticFeedback` | `'vibrate' in navigator` | true |
| `hasNativeDialogs` | false | true |
| `hasThemeSync` | false | true |
| `hasInvoice` | false | true |
| `hasCloudStorage` | true (`localStorage`) | true |
| `hasShare` | `'share' in navigator` | true |

---

## 6. WebSocket (`src/providers/WebSocketProvider.tsx` + `WebSocketContext.ts`)

Коннектится автоматически при `isAuthenticated && accessToken`. URL = `{VITE_API_URL → ws(s)://}/cabinet/ws?token={encodeURIComponent(accessToken)}`.

Механика:
- Ping каждые 25 сек (конфиг в `src/config/constants.ts`, секция `WS`).
- Exponential backoff, максимум `WS.MAX_RECONNECT_ATTEMPTS`.
- Code `1008` (auth reject) — окончательный отказ, reconnect не запускается.
- `'pong'` и `'connected'` игнорируются.
- Каждый handler — в try/catch.

**Использование:**
```ts
const { isConnected, subscribe } = useWebSocketContext();
useEffect(() => subscribe((msg) => {
  if (msg.type === 'my_event') { /* ... */ }
}), [subscribe]);
```

`WSMessage` (из `WebSocketContext.ts`) — объект с обязательным `type` и опциональными полями:
- тикеты: `ticket_id, title`
- баланс: `amount_kopeks, amount_rubles, new_balance_kopeks, new_balance_rubles, description`
- подписки: `subscription_id, expires_at, new_expires_at, tariff_name, days_left, subscription_url`
- покупка девайсов: `devices_added, new_device_limit`
- покупка трафика: `traffic_gb_added, new_traffic_limit_gb`
- autopay: `required_kopeks, required_rubles, balance_kopeks, balance_rubles, reason`
- реферал: `bonus_kopeks, bonus_rubles, referral_name`
- оплата: `payment_method`
- общее: `message, user_id, is_admin`

Глобальные WS-события обрабатывает `src/components/WebSocketNotifications.tsx` — он слушает шину и вызывает `useSuccessNotification.show(...)` на покупках/пополнениях.

---

## 7. Theme & branding

`useTheme()` (`src/hooks/useTheme.ts`) — `{ isDark, toggleTheme }`, синкает предпочтение в API. Fallback: Telegram `themeParams` → `prefers-color-scheme`.

`ThemeColorsProvider` (`src/providers/ThemeColorsProvider.tsx`) — на монтировании фетчит `themeColorsApi.getColors()` (staleTime 5 мин, retry 1), применяет `applyThemeColors(colors ?? DEFAULT_THEME_COLORS)`. Если `capabilities.hasThemeSync` — зовёт `platform.theme.setHeaderColor()` / `setBottomBarColor()`. Выбор surface зависит от `isDark`.

CSS-переменные — `src/styles/globals.css` (`--primary-*`, `--background`, `--foreground`). **В коде — Tailwind utilities** (`bg-primary`, `text-foreground`), не хардкод цветов.

Брендинг: `useBranding()` (`src/hooks/useBranding.ts`) — `{ name, logo, colors, loginAnimation, ... }`. Fallback — `VITE_APP_NAME` / `VITE_APP_LOGO`.

---

## 8. Zustand stores (`src/store/`)

Все — `create<T>(...)` без `persist`, **кроме `useAuthStore`** (persist с `localStorage` key `'cabinet-auth'`, но **только для `user`**; токены отдельно в `tokenStorage`).

### `useAuthStore` (`auth.ts`)
State: `accessToken, refreshToken, user, isAuthenticated, isLoading, isAdmin, pendingCampaignBonus`.

Методы:
- `setTokens(access, refresh)`, `setAccessToken(access)`, `setUser(user)`, `setIsAdmin(flag)`.
- `clearCampaignBonus()`.
- `logout()` — `tokenStorage.clearTokens()`, сброс state, `usePermissionStore.reset()`.
- `initialize()` — один раз на старте: миграция токенов из legacy localStorage, валидация refresh, `/me` + `/me/is-admin`.
- `checkAdminStatus()` — `GET /cabinet/auth/me/is-admin`; при `isAdmin` тянет permissions.
- `refreshUser()` — `authApi.getMe()`.
- Логины: `loginWithTelegram(initData)`, `loginWithTelegramWidget(data)`, `loginWithTelegramOIDC(idToken)`, `loginWithEmail(email, password)`, `loginWithOAuth(provider, code, state, deviceId?)`, `loginWithDeepLink(token, campaignSlug?)`, `registerWithEmail(email, password, firstName?, referralCode?)`.
- Все логины подхватывают campaign/referral коды из sessionStorage (`utils/campaign.ts`, `utils/referral.ts`).

### `useBlockingStore` (`blocking.ts`)
State: `blockingType: 'maintenance' | 'channel_subscription' | 'blacklisted' | null`, `maintenanceInfo`, `channelInfo`, `blacklistedInfo`.

Методы: `setMaintenance(info)`, `setChannelSubscription(info)`, `setBlacklisted(info)`, `clearBlocking()`.

Выставляется из error-handler'ов в `api/client.ts`. `App.tsx` рендерит соответствующий `BlockingOverlay` вместо обычных роутов.

### `usePermissionStore` (`permissions.ts`)
State: `permissions: string[], roles: string[], roleLevel: number, isLoaded: boolean`.

Методы:
- `fetchPermissions()` — `GET /cabinet/auth/me/permissions`.
- `hasPermission(code)` — **wildcard**: `*:*` = всё, `section:*` = любые в секции.
- `hasAnyPermission(...codes)`, `hasAllPermissions(...codes)`.
- `canManageRole(level)` — `roleLevel > level`.
- `reset()` — чистит (logout / не админ).

Используется `PermissionRoute` и `PermissionGate` (`src/components/auth/`).

### `useSuccessNotification` (`successNotification.ts`)
State: `isOpen`, `data: SuccessNotificationData | null`, `closeOthersSignal: number`.

`SuccessNotificationType`: `'balance_topup' | 'subscription_activated' | 'subscription_renewed' | 'subscription_purchased' | 'devices_purchased' | 'traffic_purchased'`.

Поля `data` (опциональные): `amountKopeks, newBalanceKopeks, expiresAt, tariffName, title, message, devicesAdded, newDeviceLimit, subscriptionId, subscriptionUrl, trafficGbAdded, newTrafficLimitGb`.

`show(data)` инкрементит `closeOthersSignal` (остальные модалки закрываются). Хук `useCloseOnSuccessNotification(onClose)` слушает сигнал.

### `useReferralNetworkStore` (`referralNetwork.ts`)
Состояние графа реф-сети: `selectedNode, hoveredNodeId, highlightedNodes: Set<string>, filters: { campaigns, partnersOnly, minReferrals }, scope: ScopeSelection[]` (лимит `MAX_SCOPE_ITEMS = 50`).

Методы: `setSelectedNode`, `setHoveredNode`, `setHighlightedNodes`, `updateFilters(partial)`, `resetFilters`, `addScope`, `removeScope(type, id)`, `clearScope`.

---

## 9. Token lifecycle (`src/utils/token.ts`)

Ключи:
- `TOKEN_KEYS.ACCESS = 'access_token'` → `sessionStorage`
- `TOKEN_KEYS.REFRESH = 'refresh_token'` → `localStorage` (primary), `sessionStorage` (fallback)
- `TOKEN_KEYS.USER = 'user'`
- `TOKEN_KEYS.TELEGRAM_INIT = 'telegram_init_data'` → `sessionStorage`
- `TG_USER_ID_KEY = 'tg_user_id'` → `localStorage` (для детекта смены Telegram-пользователя)

**Access никогда не в localStorage.** `refresh` — в localStorage намеренно, чтобы сессия пережила закрытие вкладки. `user` персистится через Zustand persist; токены — нет.

API:
- `decodeJWT(token)` → `{ exp?, iat?, sub?, ... }`.
- `isTokenExpired(token, bufferSeconds = 30)`, `isTokenValid(token)`.
- `tokenStorage`: `getAccessToken`, `getRefreshToken`, `setTokens(a, r)`, `setAccessToken(a)`, `clearTokens`, `migrateFromLocalStorage`, `getTelegramInitData`, `setTelegramInitData`.
- `tokenRefreshManager` (singleton):
  - `setRefreshEndpoint(endpoint)` — настраивается в `api/client.ts`.
  - `refreshAccessToken()` — **дедуплицирован**: если refresh уже идёт, возвращает тот же promise. Критично: параллельные 401 не запустят параллельные refresh'ы.
  - `subscribe((token) => void)` → unsubscribe.
  - `isRefreshInProgress`, `waitForRefresh()`.
  - Внутри — plain axios (не `apiClient`), чтобы не было цикла через interceptors.
- Redirect helpers:
  - `saveReturnUrl()` — сохраняет `pathname + search` если не на `/login`.
  - `getAndClearReturnUrl()`.
  - `safeRedirectToLogin()` — с защитой от циклов.
  - `isValidRedirectUrl(url)` — same-origin проверка.
- `clearStaleSessionIfNeeded(freshInitData)` — сравнивает Telegram user ID с сохранённым, чистит токены при смене пользователя.

---

## 10. API layer (`src/api/`)

**`client.ts` — Axios instance:**
- `baseURL` = `VITE_API_URL || '/api'`.
- Refresh endpoint — `{baseURL}/cabinet/auth/refresh`.
- Request interceptor:
  - `Authorization: Bearer <access>` (кроме auth-эндпоинтов).
  - `X-Telegram-Init-Data` если есть.
  - `X-CSRF-Token` на POST/PUT/PATCH/DELETE. CSRF — 32 байта hex на клиенте, в secure cookie `SameSite=Strict; Secure`.
  - Если access истекает <30 сек — молча рефрешит перед отправкой.
- Response interceptor:
  - `401` — один retry через `tokenRefreshManager.refreshAccessToken()`.
  - `503` + code `maintenance` → `isMaintenanceError()` → `useBlockingStore.setMaintenance(...)`.
  - `403` + code `channel_subscription_required` → `isChannelSubscriptionError()` → `setChannelSubscription(...)`.
  - `403` + code `blacklisted` → `isBlacklistedError()` → `setBlacklisted(...)`.
- Deeplink-эндпоинты используют особый `validateStatus` (202/410 не ошибки).

**Модули API** — по одной фиче на файл, экспортируют `xxxApi`:

| Файл | Export | Назначение |
|---|---|---|
| `auth.ts` | `authApi` | login/register/OAuth/merge/refresh/password-reset/email-change/linked-providers/deeplink |
| `subscription.ts` | `subscriptionApi` | подписки, trial, покупка, продление |
| `balance.ts` | `balanceApi` | баланс, транзакции, депозиты |
| `tariffs.ts` | `tariffsApi` | тарифы и цены |
| `servers.ts` | `serversApi` | список серверов |
| `referral.ts` | `referralApi` | реф-ссылки, earnings, withdrawals |
| `referralNetwork.ts` | `referralNetworkApi` | граф реф-сети, scoped queries |
| `notifications.ts` | `notificationsApi` | настройки нотификаций |
| `tickets.ts` | `ticketsApi` | тикеты |
| `ticketNotifications.ts` | `ticketNotificationsApi` | preferences по тикетам |
| `contests.ts` | `contestsApi` | конкурсы |
| `polls.ts` | `pollsApi` | опросы |
| `promo.ts` | `promoApi` | промо |
| `promocodes.ts` | `promocodesApi` | валидация/применение |
| `promoOffers.ts` | `promoOffersApi` | персональные offers |
| `info.ts` | `infoApi` | FAQ / rules / offer / privacy |
| `branding.ts` | `brandingApi` | конфиг бренда |
| `themeColors.ts` | `themeColorsApi` | цвета темы |
| `currency.ts` | `currencyApi` | курсы |
| `gift.ts` | `giftApi` | подарки подписок |
| `news.ts` | `newsApi` | статьи |
| `wheel.ts` | `wheelApi`, `adminWheelApi` | колесо |
| `menuLayout.ts` | — | раскладка меню |
| `landings.ts` | — | лендинги |
| `modem.ts` | `modemApi` | модем/роутер |
| `withdrawals.ts` | `withdrawalsApi` | заявки на вывод |
| `campaigns.ts` | `campaignsApi` | кампании |
| `banSystem.ts` | `banSystemApi` | баны |
| `buttonStyles.ts` | `buttonStylesApi` | стили кнопок, `BOT_LOCALES = ['ru','en','ua','zh','fa']` |
| `partners.ts` | — | партнёры |
| `rbac.ts` | — | роли/политики |
| `index.ts` | — | реэкспорт |

**Админ-модули** (`admin*.ts`): `admin.ts` (tickets+settings+stats), `adminApps.ts`, `adminBroadcasts.ts`, `adminChannels.ts`, `adminEmailTemplates.ts`, `adminHapp.ts`, `adminPaymentMethods.ts`, `adminPayments.ts`, `adminPinnedMessages.ts`, `adminRemnawave.ts`, `adminSalesStats.ts`, `adminSettings.ts`, `adminTraffic.ts`, `adminUpdates.ts`, `adminUsers.ts`.

Добавляя endpoint — в соответствующий файл, не в общий.

**Ключевые `authApi` методы:** `loginTelegram`, `loginTelegramWidget`, `loginTelegramOIDC`, `loginEmail`, `registerEmail`, `registerEmailStandalone`, `verifyEmail`, `resendVerification`, `refreshToken`, `logout`, `forgotPassword`, `resetPassword`, `getMe`, `requestEmailChange`, `verifyEmailChange`, `getOAuthProviders`, `getOAuthAuthorizeUrl`, `oauthCallback`, `getLinkedProviders`, `linkProviderInit`, `linkProviderCallback`, `linkTelegram`, `linkServerComplete`, `unlinkProvider`, `autoLogin`, `requestDeepLinkToken`, `pollDeepLinkToken`, `getMergePreview`, `executeMerge`.

---

## 11. Components (`src/components/`)

### Top-level `.tsx`
| Файл | Назначение |
|---|---|
| `CampaignBonusNotifier.tsx` | нотификация бонуса кампании после логина |
| `ColorPicker.tsx` | UI выбора цвета |
| `ErrorBoundary.tsx` | `level: 'app' \| 'page'` |
| `InsufficientBalancePrompt.tsx` | модалка "недостаточно средств" |
| `LanguageSwitcher.tsx` | переключатель языка |
| `OAuthProviderIcon.tsx`, `PaymentMethodIcon.tsx`, `ProviderIcon.tsx` | иконки по типу |
| `Onboarding.tsx` | first-time flow |
| `PromoOffersSection.tsx` | блок промо-офферов |
| `SuccessNotificationModal.tsx` | слушает `useSuccessNotification`, рендерит модалку |
| `SupportHelperSheet.tsx` | sheet ассистента |
| `TelegramLoginButton.tsx` | Login Widget |
| `TicketNotificationBell.tsx` | иконка-колокольчик |
| `Toast.tsx` | toast provider + `useToast()` |
| `WebBackButton.tsx` | back-кнопка для веба |
| `WebSocketNotifications.tsx` | глобальный WS-listener |

### Подпапки
| Подпапка | Содержимое |
|---|---|
| `admin/` | `AdminLayout.tsx`, `BackgroundConfigEditor.tsx`, `BrandingTab.tsx`, `ButtonsTab.tsx`, `MenuEditorTab.tsx` (drag-drop через `@dnd-kit`), `ThemeTab.tsx`, `AnalyticsTab.tsx`, `SettingsSearch.tsx`, `SettingsTreeSidebar.tsx`, `constants.ts` |
| `auth/` | `PermissionRoute.tsx`, `PermissionGate.tsx` |
| `backgrounds/` | `BackgroundRenderer.tsx` (портал в `document.body`, `z-index: -1`), `BackgroundPreview.tsx` |
| `blocking/` | `MaintenanceScreen.tsx`, `ChannelSubscriptionScreen.tsx`, `BlacklistedScreen.tsx` |
| `common/` | `PageLoader.tsx` (`variant: 'dark' \| 'light'`) |
| `connection/` | компоненты для `/connection` (QR, список приложений, deep-link кнопки) |
| `dashboard/` | `SubscriptionCardActive`, `SubscriptionCardExpired`, `TrafficProgressBar`, `Sparkline`, `StatsGrid`, `PendingGiftCard`, `TrialOfferCard` |
| `data-display/` | `Card/`, `StatCard/` |
| `icons/` | `index.tsx` (общий набор), `LandingIcons.tsx`. Импорт: `import { X } from '@/components/icons'` |
| `layout/` | `Layout.tsx` → `<AppShell>`. `AppShell/`: `AppShell.tsx`, `AppHeader.tsx`, `DesktopSidebar.tsx`, `MobileBottomNav.tsx`, `icons.tsx`, `index.ts`. Breakpoint `md` (768px) |
| `motion/` | `transitions.ts` (`staggerContainer`, `staggerItem`, `fadeIn`, `slideUp`), `FadeIn.tsx`, `SlideUp.tsx` |
| `navigation/` | `CommandPalette/` (cmdk) |
| `news/` | `NewsSection.tsx`, `GridBackground.tsx` |
| `partner/` | `CampaignCard.tsx`, `CampaignDetailStats.tsx`, `TopReferrals.tsx` |
| `primitives/` | Radix + CVA wrappers: `Button/`, `Command/`, `Dialog/`, `DropdownMenu/`, `Popover/`, `Select/`, `Sheet/`, `Switch/`, `Tooltip/`. **Не пишите свои** Dialog/Popover/Select — используйте эти. |
| `sales-stats/` | Recharts для `/admin/sales-stats`: `SimpleAreaChart`, `MultiSeriesAreaChart`, `DualAreaChart`, `SimpleBarChart`, `DonutChart`, `PeriodSelector`, табы `SalesTab`/`DepositsTab`/`RenewalsTab`/`TrialsTab`/`AddonsTab` |
| `stats/` | `DailyChart.tsx`, `PeriodComparison.tsx`, `StatCard.tsx`, `constants.ts`, `types.ts` |
| `subscription/` | `SubscriptionListCard.tsx`, `PurchaseCTAButton.tsx` |
| `ui/backgrounds/` | статические фоны/паттерны |
| `wheel/` | компоненты колеса фортуны |

---

## 12. Hooks (`src/hooks/`)

| Hook | Результат / Назначение |
|---|---|
| `useAnalyticsCounters` | инициализация и трекинг счётчиков |
| `useAnimatedNumber` | анимированный переход числа (таргет, ~1200ms) |
| `useAnimationLoop` | requestAnimationFrame-цикл с pause |
| `useBranding` | `{ name, logo, colors, ... }` через `brandingApi` с кешем |
| `useChartColors` | theme-aware палитра для Recharts |
| `useCurrency` | форматирование/конвертация валют |
| `useFavoriteSettings` | избранные admin settings в localStorage |
| `useFeatureFlags` | флаги фич (referral/wheel/contests/polls/gift/...) |
| `useHeaderHeight` | высоты mobile/desktop header + safe areas |
| `useScrollRestoration` | восстановление scroll на навигацию |
| `useTelegramSDK` | `isInTelegramWebApp()`, `isTelegramMobile()`, `getTelegramInitData()`, `useTelegramSDK()` → `{ isFullscreen, viewport, platform, haptic }` |
| `useTheme` | `{ isDark, toggleTheme }`, синк в API |
| `useThemeColors` | фетч + применение CSS vars |
| `useTrafficZone` | зона трафика (warning/critical) |
| `useUserThemePreferences` | кешированные предпочтения темы |
| `useWebSocket` | реэкспорт `useContext(WebSocketContext)` |

---

## 13. Utils (`src/utils/`)

| Файл | Назначение |
|---|---|
| `token.ts` | см. §9 |
| `api-error.ts` | нормализация `AxiosError` → UI-message |
| `backgroundConfig.ts` | парсинг/сериализация конфига фона |
| `campaign.ts` | capture/consume campaign slug из URL в sessionStorage |
| `clipboard.ts` | copy-to-clipboard с fallback |
| `colorConversion.ts` | RGB ↔ HEX |
| `colorParser.ts` | парсинг CSS-цветов |
| `connectionLink.ts` | генерация subscription URL + deep-link'ов на VPN-клиенты |
| `format.ts` | общий форматинг чисел/дат |
| `formatTraffic.ts` | байты → KB/MB/GB/TB |
| `glassTheme.ts` | glassmorphism-конфиг |
| `inputHelpers.ts` | валидация/санитизация input'ов |
| `logger.ts` | debug-логгер (тихий в prod) |
| `oauth.ts` | OAuth state/code helpers |
| `paymentStatus.ts` | enum + helpers статуса платежа |
| `rateLimit.ts` | throttle/debounce |
| `referral.ts` | capture/consume referral-кода из URL |
| `subscriptionHelpers.ts` | истечение / продление / статусы |
| `templateEngine.ts` | простая подстановка `{var}` |
| `topUpStorage.ts` | состояние top-up flow между шагами |
| `trafficZone.ts` | детекция зоны (warning/critical) |
| `validation.ts` | валидация форм |
| `withdrawalUtils.ts` | заявки на вывод |

---

## 14. Pages (`src/pages/`)

**Неочевидные страницы:**
- `MergeAccounts.tsx` — слияние двух аккаунтов через `mergeToken`; pending bonuses, warning'и, countdown.
- `AutoLogin.tsx` — автологин через query-параметр; strict referrer policy, чтобы токен не утёк.
- `DeepLinkRedirect.tsx` — запуск VPN-клиента через scheme (`happ://`, `flclash://`, `v2rayng://`, и ещё 14+); валидация схем, 5-сек countdown перед fallback.
- `QuickPurchase.tsx` + `PurchaseSuccess.tsx` — deep-link flow покупки по slug'у.
- `LinkTelegramCallback.tsx` — привязка Telegram к существующему email-аккаунту.
- `LegacySubscriptionRedirect` — редирект `/subscription/:id` → `/subscriptions/:id` (локальный в `App.tsx`).

**Top-up flow:** `TopUpMethodSelect` → `TopUpAmount` → `TopUpResult`. Состояние между шагами — `utils/topUpStorage.ts`.

**User pages:** Dashboard, Subscriptions/Subscription/SubscriptionPurchase/RenewSubscription, Balance/SavedCards, Referral + 2 подстраницы, Support, Profile/ConnectedAccounts, Wheel, Contests, Polls, Info, Connection/ConnectionQR, GiftSubscription/GiftResult, NewsArticle.

**Auth/callbacks:** Login, TelegramCallback, TelegramRedirect, OAuthCallback, VerifyEmail, ResetPassword.

**Admin (65+ страниц):** все из §4. `ReferralNetwork/` — отдельная папка, остальные — плоские `AdminXxx.tsx`.

---

## 15. Config / constants / data / lib / types

**`src/config/constants.ts`** — центральный конфиг. Секции:
- `STORAGE_KEYS` — ключи localStorage/sessionStorage.
- `WS` — `MAX_RECONNECT_ATTEMPTS`, ping интервал.
- `UI` — высоты header'ов, cooldown'ы.
- `API` — timeout, cache, пороги трафика.

**`src/constants/`:**
- `charts.ts` — палитры графиков.
- `partner.ts` — партнёрская система.
- `paymentMethods.ts` — типы / конфиги.
- `salesStats.ts` — константы отчётов.

**`src/data/`:** `colorPresets.ts` — пресеты для Background/Theme editor'ов.

**`src/lib/`:**
- `utils.ts` — `cn(...)` (clsx + tailwind-merge). **Используйте её** для классов, не ручную конкатенацию.
- `tiptap-video.ts` — расширение Tiptap для видео в rich-text editor'е (админские новости/темплейты).

**`src/types/`:**
- `index.ts` — общие типы (User, Subscription, Payment, Tariff, ...).
- `news.ts` — News.
- `referralNetwork.ts` — Graph/Network/Scope типы.
- `theme.ts` — ThemeColors.

---

## 16. i18n (`src/i18n.ts`, `src/locales/`)

Четыре языка: **`ru`, `en`, `fa`, `zh`** (файлы `src/locales/*.json`).

Детекция по приоритету:
1. `localStorage['cabinet_language']`.
2. Telegram `user.language_code` (если в WebApp).
3. `navigator.language`.
4. Fallback → `ru`.

Один namespace `translation`, языки грузятся динамически (chunk на язык), `useSuspense: false`.

**При добавлении любого текста:** ключ во всех **четырёх** `locales/*.json`. Отсутствие — fallback-строка в проде. **Hardcoded русских/английских строк в компонентах быть не должно** — только `useTranslation()`.

---

## 17. Build / bundle

`vite.config.ts`:
- Alias `@ → src`.
- `__APP_VERSION__` — global из `package.json`.
- `base: '/'` — **менять здесь** для sub-path (`/cabinet/`).
- Dev :5173, прокси `/api` → `http://localhost:8080` с rewrite (удаляет префикс).
- `build.chunkSizeWarningLimit: 550`.
- `manualChunks` — ручное разбиение vendor'ов: `vendor-react`, `vendor-query`, `vendor-table`, `vendor-i18n`, `vendor-motion`, `vendor-radix`, `vendor-dnd`, `vendor-telegram`, `vendor-webgl`, `vendor-cmdk`, `vendor-twemoji`, `vendor-crypto`, `vendor-lottie`, `vendor-utils`. Добавляете тяжёлую либу и превышаете warning — впишите сюда или переведите на dynamic import.

TS: `strict: true`. Избегайте `any` (`@typescript-eslint/no-explicit-any: warn`).

ESLint (`eslint.config.js`): `@eslint/js recommended` + `typescript-eslint recommended` + `react-hooks` + `react-refresh` + `eslint-config-prettier`. Unused vars — warn, игнорируются с префиксом `_`. `no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url` — error.

Prettier: `.prettierrc` + `prettier-plugin-tailwindcss` (автосортировка Tailwind-классов — **не правьте порядок руками**).

---

## 18. Conventions

- **Functional components + hooks.** Классовых нет.
- **`lazyWithRetry` для страниц,** не голый `React.lazy` — иначе после деплоя с новыми хэшами старая вкладка падает.
- **Переводы во всех 4 локалях.** Hardcoded строк нет.
- **Access-токен — только sessionStorage.** Не в Zustand persist, не в localStorage. Refresh — в localStorage намеренно.
- **Блокирующие API-ошибки — через `isXxxError` + `useBlockingStore`.** Обычные — через `api-error.ts` → toast.
- **Platform-specific behavior — через хуки `src/platform/`,** не `if (window.Telegram)`.
- **Permission checks — `usePermissionStore` / `PermissionRoute` / `PermissionGate`,** не по `user.role`.
- **Новый store — в `src/store/`, экспорт `useXxxStore`.** Persist только если действительно нужно; токены — никогда.
- **CSS — Tailwind + CSS vars из `globals.css`,** не inline-цвета.
- **React Query keys — массивы с иерархией** (`['subscriptions', userId]`), `enabled: isAuthenticated` на защищённых запросах.
- **Комментарии — только на "почему".** "Что" видно из кода.

---

## 19. Debug checklist

| Симптом | Причина |
|---|---|
| CORS в консоли | Домен не в `CABINET_ALLOWED_ORIGINS` на backend |
| 401 бесконечно | Refresh не срабатывает — смотрите `tokenRefreshManager` и network tab; refresh истёк → `/login` |
| WS не коннектится | Backend не держит WS на `/cabinet/ws`; либо токен `1008`-reject |
| Telegram-функции не работают в вебе | Норма, используйте `usePlatform()` + `capabilities.*` для fallback |
| Белый экран после деплоя | Старые хэши; `lazyWithRetry` должен перезагрузить, guard 30 сек |
| `hasPermission` всегда false | `usePermissionStore.isLoaded === false` — `checkAdminStatus()` не успел; либо не админ |
| Фон не применяется | Конфиг в `utils/backgroundConfig.ts`; `BackgroundRenderer` рендерит портал в `document.body` |
| `/admin/xxx` редиректит | Нет permission-кода; проверьте на backend и что он приходит в `/me/permissions` |

---

## 20. Когда править этот файл

- Добавили/удалили страницу или роут — §4.
- Новый store — §8.
- Новая platform capability — §5.
- Новый API-модуль — §10.
- Новая config-константа / feature flag — §15.
- Язык добавили/переименовали — §16.
- Изменили build-конфиг (chunks, base, alias) — §17.
