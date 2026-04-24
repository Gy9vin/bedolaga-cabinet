# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bedolaga Cabinet — веб-интерфейс личного кабинета для VPN бота [Remnawave Bedolaga Telegram Bot](https://github.com/BEDOLAGA-DEV/remnawave-bedolaga-telegram-bot). React 19 + Vite 7 + TypeScript SPA, работающее одновременно как Telegram Mini App и как обычное веб-приложение. Backend API бота проксируется через `/api/*`.

Релизы ведутся через release-please (см. `CHANGELOG.md`). Актуальная версия берётся из `package.json` и прокидывается в bundle как глобальный `__APP_VERSION__`.

## Commands

```bash
npm run dev          # Vite dev server, port 5173, проксирует /api → localhost:8080
npm run build        # tsc (полный type-check) + vite build в dist/
npm run type-check   # tsc --noEmit, без сборки
npm run preview      # Предпросмотр собранного dist/
npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run format       # prettier --write для src/**
npm run format:check # prettier --check
```

Тестов в репозитории нет — нет фреймворка тестирования, нет `npm test`. Проверка кода = type-check + lint + ручной прогон фичи в браузере и в Telegram Mini App.

Husky + lint-staged запускают `eslint --fix` и `prettier --write` на staged `.ts/.tsx` при каждом коммите (`.husky/pre-commit`). Не обходите хук без явного запроса пользователя.

Docker:
```bash
docker compose up -d --build    # multi-stage build (Node → Nginx), раздаёт dist на 80
```

## Path alias

`@/*` → `src/*` (см. `vite.config.ts` и `tsconfig.json`). Используйте `@/...` для кросс-модульных импортов вместо длинных относительных путей.

## Architecture

### Platform abstraction (`src/platform/`)
Ключевая особенность: одна и та же сборка работает в Telegram WebApp и в обычном браузере. `PlatformProvider` детектит окружение и подставляет `TelegramAdapter` (на `@telegram-apps/sdk-react`) или `WebAdapter` (fallback через `alert`/`toast`). Всегда используйте хуки отсюда вместо прямого обращения к `window.Telegram` или `alert()`:
- `useBackButton()` — Telegram back button (в веб-режиме no-op / кастомный `WebBackButton`)
- `useHaptic()` — тактильная отдача
- `useNativeDialog()` — `showPopup` / `showAlert` / `showConfirm`
- `useNotify()` — уведомления
- `usePlatform()` — `{ platform: 'telegram' | 'web', capabilities }`

### Auth & tokens
Две схемы логина: Telegram (`initData` или Login Widget) и email/password. После логина используется одна и та же JWT-пара.

Хранение токенов — `src/utils/token.ts`. **Только `sessionStorage`** (access, refresh, Telegram `initData`). Не добавляйте токены в `localStorage` и не оборачивайте auth store в Zustand `persist` — это осознанное решение для безопасности.

Refresh централизован через `tokenRefreshManager` (в том же файле) — он сериализует параллельные refresh'ы, чтобы при 401 не возникало гонок между несколькими одновременными запросами. `useAuthStore.initialize()` вызывается один раз на старте и восстанавливает сессию.

### API client (`src/api/client.ts`)
Axios instance с двумя interceptor'ами:
- **Request**: `Authorization: Bearer`, `X-Telegram-Init-Data` (если есть), CSRF-токен на мутирующих методах (POST/PUT/PATCH/DELETE).
- **Response**: 401 → refresh и повтор; 503 + особый признак → `isMaintenanceError`; 403 + признак подписки → `isChannelSubscriptionError`.

Оба «блокирующих» состояния поднимают флаги в `useBlockingStore`, и App.tsx рендерит вместо приложения `MaintenanceScreen` / `ChannelSubscriptionScreen` / `BlacklistedScreen` (см. `src/components/blocking/`). Это глобальная блокировка UI, не модалка.

Модульные API-клиенты в `src/api/*.ts` сгруппированы по фиче (`admin*.ts` для админки, `auth.ts`, `subscription.ts`, `tickets.ts` и т. д.). Добавляя новый endpoint, кладите его в соответствующий файл, а не в один общий.

### WebSocket (`src/providers/WebSocketProvider.tsx`)
Подключается после аутентификации. Exponential backoff, максимум 5 попыток, ping/pong keep-alive. Глобальные обработчики уже есть для subscription updates, balance changes, ticket notifications.

Для подписки на свои события:
```ts
const { subscribe } = useWebSocketContext();
useEffect(() => subscribe((msg) => { /* ... */ }), []);
```

### State management
Zustand stores в `src/store/`:
- `auth` — пользователь, токены, `isAdmin`
- `blocking` — maintenance / channel subscription / blacklisted блокировки
- `permissions` — RBAC: набор permission-кодов, используется `PermissionRoute` и компонентами админки
- `successNotification` — глобальные success-модалки
- `referralNetwork` — состояние страницы реф-сети

Серверные данные — `@tanstack/react-query`. Всегда ставьте `enabled: isAuthenticated` на защищённых запросах, иначе query будет улетать до готовности токенов.

### Routing
`react-router@7`, полностью описано в `src/App.tsx`. Страницы лениво грузятся через `lazyWithRetry` — это обёртка над `React.lazy`, которая после деплоя с новыми chunk-хешами один раз перезагружает страницу (guard 30 сек через `sessionStorage`), чтобы пользователь не застрял с устаревшими чанками. Используйте её для новых страниц.

Защита маршрутов:
- `AdminRoute` — проверяет `isAdmin` из `useAuthStore`
- `PermissionRoute` (`src/components/auth/PermissionRoute.tsx`) — проверяет конкретные permission-коды из `usePermissionsStore`; используется в админ-подразделах с fine-grained RBAC

### Layout
`src/components/layout/AppShell/` — основной shell: Sidebar + Header на desktop, bottom nav на mobile (breakpoint `md`, 768px). `AppHeader` содержит command palette (Cmd+K), нотификации, профиль. Админка — отдельный `AdminLayout` (`src/components/admin/AdminLayout.tsx`) с breadcrumbs и своей навигацией.

### i18n
`i18next` + `react-i18next`. Четыре языка: `en`, `ru`, `fa`, `zh` — файлы в `src/locales/`. Детекция: Telegram `user.language` → browser → `ru`. При добавлении текста — ключ должен существовать во **всех четырёх** файлах (иначе получите fallback-строку в проде). Никаких hardcoded русских/английских строк в компонентах.

### Theme
Двойной режим (auto по Telegram/ОС + manual override). Динамические бренд-цвета через `useThemeColorsStore` / `ThemeColorsProvider`. Цвета — CSS-переменные в `src/styles/globals.css`; в коде используйте Tailwind utilities (`bg-primary`, `text-foreground`), а не хардкод цветов.

### UI stack
- Radix UI primitives (Dialog, Popover, Select, Tabs, ...) — не заменяйте самописными.
- `src/components/primitives/` — стилизованные обёртки над Radix + CVA.
- `framer-motion` для анимаций.
- Иконки — собственный набор в `src/components/icons/`, импорт `from '@/components/icons'`.
- Таблицы — `@tanstack/react-table`.
- Редактор — `@tiptap/*`.
- DnD — `@dnd-kit/*`.

### Build
Manual chunks в `vite.config.ts` разделяют vendor-код на именованные chunks (`vendor-react`, `vendor-radix`, `vendor-telegram`, `vendor-query`, и т. д.) — chunk size warning лимит 550KB. Если добавляете тяжёлую библиотеку и попадаете в warning — либо добавьте её в `manualChunks`, либо переведите на dynamic import.

`base: '/'` в `vite.config.ts` — если разворачивать кабинет на sub-path (`/cabinet/`), меняется **здесь**.

## Environment variables

Build-time (вшиваются в bundle, требуют пересборки):
- `VITE_API_URL` — обычно `/api` (прокси Caddy/Nginx на backend:8080); для удалённого backend — полный URL
- `VITE_TELEGRAM_BOT_USERNAME` — без `@`
- `VITE_APP_NAME`, `VITE_APP_LOGO` — брендинг в шапке и title

Runtime (только для Docker-образа): `CABINET_PORT` (host-порт, дефолт 3020).

Backend бота (в его `.env`, не здесь): `CABINET_ENABLED=true`, `CABINET_JWT_SECRET`, `CABINET_ALLOWED_ORIGINS` — без них кабинет не заработает. Отсутствие домена кабинета в `CABINET_ALLOWED_ORIGINS` даёт CORS-ошибку.

## Conventions

- TypeScript strict mode, избегайте `any` (`@typescript-eslint/no-explicit-any` = warn).
- Functional components + hooks. Классовых компонентов в кодбазе нет.
- Unused vars игнорируются только если начинаются с `_` (`_arg`, `_unused`).
- Добавляя новую страницу: `lazyWithRetry` в `App.tsx`, маршрут, перевод во **все** `locales/*.json`, проверка и в Telegram, и в браузере, и в light/dark темах.

## Debugging checklist

- CORS → `CABINET_ALLOWED_ORIGINS` на backend
- 401 в цикле → смотрите, срабатывает ли `tokenRefreshManager`; истёкший refresh → `/login`
- WebSocket не коннектится → backend должен держать WS на `/cabinet/ws`
- Telegram-специфичные функции не работают в браузере → это норма, используйте `usePlatform()` для fallback
- Белый экран после деплоя → скорее всего старая вкладка с устаревшими chunk-хешами; `lazyWithRetry` должен сам перезагрузить, guard — 30 сек
