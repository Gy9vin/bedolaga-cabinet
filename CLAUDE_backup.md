# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bedolaga Cabinet - современный веб-интерфейс личного кабинета для VPN бота [Remnawave Bedolaga Telegram Bot](https://github.com/BEDOLAGA-DEV/remnawave-bedolaga-telegram-bot). React + Vite + TypeScript приложение, работающее как в Telegram Mini App, так и в обычном браузере.

## Commands

### Development
```bash
npm run dev              # Start dev server on port 5173 with API proxy
npm run build            # Type check + production build
npm run preview          # Preview production build
npm run type-check       # Run TypeScript type checking
```

### Code Quality
```bash
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors automatically
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without changes
```

### Docker
```bash
docker compose up -d --build    # Build and run in Docker
docker compose down             # Stop containers
```

## Architecture

### Platform Abstraction Layer (`src/platform/`)

**Ключевая архитектурная особенность**: приложение работает в двух окружениях - Telegram Mini App и обычный браузер. Слой абстракции платформы унифицирует API:

- **`PlatformProvider`**: Определяет окружение и предоставляет правильный адаптер
- **`TelegramAdapter`**: Использует `@telegram-apps/sdk-react` для Telegram-специфичных функций
- **`WebAdapter`**: Fallback реализация для браузера (alerts, console warnings)

**Основные возможности**:
- `useBackButton()` - управление кнопкой "Назад" в Telegram
- `useHaptic()` - тактильная обратная связь (вибрация)
- `useNativeDialog()` - нативные диалоги (Telegram popup vs browser alert)
- `useNotify()` - уведомления (Telegram showAlert vs toast)

**Всегда используйте** эти хуки вместо прямого обращения к `window.Telegram` или `alert()`.

### Authentication & Token Management

**Двойная система аутентификации**:
1. **Telegram** (основной способ): через `initData` или Telegram Login Widget
2. **Email/Password** (автономный): для доступа вне Telegram

**Token Storage** (`src/utils/token.ts`):
- Access tokens: `sessionStorage` (безопасность)
- Refresh tokens: `sessionStorage`
- Telegram initData: `sessionStorage` (для повторной аутентификации)
- **Никогда не храните токены в localStorage или Zustand persist**

**Auth Flow**:
1. `useAuthStore.initialize()` вызывается при старте приложения
2. Проверяет токены в `tokenStorage`
3. Если access token истёк → автоматический refresh через `tokenRefreshManager`
4. При 401 → повторный refresh или редирект на `/login`

**Token Refresh**: централизован в `tokenRefreshManager` для предотвращения race conditions при множественных параллельных запросах.

### API Client (`src/api/client.ts`)

**Axios instance** с interceptors:
- **Request**: добавляет `Authorization`, `X-Telegram-Init-Data`, `X-CSRF-Token`
- **Response**: обрабатывает 401 (refresh), 503 (maintenance), 403 (channel subscription)

**Special Error Handling**:
- `isMaintenanceError()` → показывает `MaintenanceScreen`
- `isChannelSubscriptionError()` → показывает `ChannelSubscriptionScreen`
- Эти экраны блокируют всё приложение через `useBlockingStore`

**CSRF Protection**: автоматически генерируется и добавляется в POST/PUT/DELETE/PATCH запросы.

### WebSocket (`src/providers/WebSocketProvider.tsx`)

**Real-time коммуникация** с backend:
- Автоматическое подключение при аутентификации
- Reconnection logic с exponential backoff (max 5 попыток)
- Ping/pong для keep-alive соединения
- Глобальные обработчики: subscription updates, balance changes, ticket notifications

**Usage**:
```typescript
const { subscribe } = useWebSocketContext();

useEffect(() => {
  const unsubscribe = subscribe((message) => {
    if (message.type === 'your_event') {
      // Handle event
    }
  });
  return unsubscribe;
}, []);
```

### Layout System

**Modern AppShell** (`src/components/layout/AppShell/`):
- **Desktop**: Sidebar + Header с Aurora gradient фоном
- **Mobile**: Bottom Navigation + Header
- **Responsive**: автоматическое переключение на breakpoint `md` (768px)
- **AppHeader**: уведомления, профиль, command palette (Cmd+K)
- **Command Palette**: глобальный поиск по страницам и действиям

**Admin Layout** (`src/components/admin/AdminLayout.tsx`):
- Отдельная навигация для админ-панели
- Breadcrumbs и back button для навигации
- Mobile tabs для настроек

### State Management

**Zustand stores** (`src/store/`):
- `useAuthStore`: пользователь, токены, admin статус
- `useBlockingStore`: maintenance/channel subscription блокировки
- `useSuccessNotificationStore`: глобальные success уведомления
- `useThemeColorsStore`: динамическая кастомизация цветов

**React Query** (`@tanstack/react-query`): для кеширования API данных.

### Routing Structure

**User routes** (`/`):
- `/login` - авторизация (Telegram/Email)
- `/dashboard` - главная страница
- `/subscription` - управление подпиской и ключами
- `/balance` - баланс и история платежей
- `/profile` - настройки профиля
- `/support` - тикеты поддержки
- `/referral` - реферальная программа
- `/wheel` - колесо фортуны

**Top-up flow** (новый, разделён на шаги):
- `/topup/method` - выбор способа оплаты
- `/topup/amount` - ввод суммы пополнения

**Admin routes** (`/admin/*`):
- Защищены `AdminRoute` (проверка `isAdmin`)
- Ленивая загрузка всех админ-страниц
- Подробные страницы: `/admin/users/:id`, `/admin/tariffs/create`, etc.

### Internationalization

**i18next** с react-i18next:
- Поддержка языков: EN, RU, FA, ZH
- Детекция языка: Telegram user language → browser language → 'ru'
- Файлы переводов: `src/locales/*.json`

**При добавлении текста**:
1. Добавить ключ во ВСЕ файлы `locales/*.json`
2. Использовать `useTranslation()` hook
3. Избегать hardcoded строк в компонентах

### Component Libraries

**UI Primitives**:
- **Radix UI**: headless компоненты (Dialog, Select, Popover, etc.)
- **Custom wrappers**: `src/components/primitives/` - стилизованные версии
- **Framer Motion**: анимации и transitions
- **TailwindCSS + CVA**: стилизация с class-variance-authority

**Icon System** (`src/components/icons/`):
- SVG иконки как React компоненты
- Единообразное использование: `import { IconName } from '@/components/icons'`

### Theme System

**Dual theme support**:
- Automatic: следует Telegram theme или browser preference
- Manual: пользователь может переключать в настройках
- Dynamic brand colors: кастомизация через `useThemeColorsStore`

**CSS Variables** (`src/styles/globals.css`):
- `--primary-*`: основные цвета бренда
- `--background`, `--foreground`: адаптируются под тему
- Используйте Tailwind utilities (`bg-primary`, `text-foreground`)

### Build & Deployment

**Environment Variables**:
- `VITE_API_URL`: путь к backend API (по умолчанию `/api`)
- `VITE_TELEGRAM_BOT_USERNAME`: имя бота (без @)
- `VITE_APP_NAME`: название приложения
- `VITE_APP_LOGO`: короткий логотип

**Vite Config**:
- Dev proxy: `/api/*` → `http://localhost:8080` (backend)
- Code splitting: vendor chunks для оптимизации загрузки
- Base path: `/` (изменить на `/cabinet/` для sub-path deployment)

**Docker**:
- Multi-stage build: Node builder → Nginx serving
- Internal nginx слушает на порту 80
- Proxyировать `/api/*` на backend через Caddy/Nginx

### Performance Optimizations

**Code Splitting**:
- Lazy loading всех page components
- Vendor chunks: react, radix-ui, telegram, motion, etc.
- Route-based splitting автоматически через React.lazy()

**Bundle Size**:
- Chunk size warning limit: 550KB
- Используйте dynamic imports для тяжёлых библиотек
- Проверяйте bundle analyzer при добавлении зависимостей

### Common Patterns

**Protected Data Fetching**:
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['resource', id],
  queryFn: () => api.getResource(id),
  enabled: isAuthenticated, // Don't fetch if not logged in
});
```

**Platform-Specific Behavior**:
```typescript
const { platform, capabilities } = usePlatform();
const { showPopup } = useNativeDialog();

if (capabilities.nativeDialogs) {
  await showPopup({ message: 'Telegram popup' });
} else {
  toast.success('Browser toast');
}
```

**Admin-Only Features**:
```typescript
const { isAdmin } = useAuthStore();

{isAdmin && <AdminButton />}
```

### Debugging

**Common Issues**:

1. **CORS errors**: проверить `CABINET_ALLOWED_ORIGINS` в backend .env
2. **401 Unauthorized**: токены могли истечь, проверить network tab для refresh запросов
3. **WebSocket не подключается**: проверить что backend поддерживает WS на `/cabinet/ws`
4. **Telegram features не работают**: убедиться что `window.Telegram.WebApp` доступен

**Dev Tools**:
- React DevTools для компонентов и state
- Network tab для API/WS запросов
- Console для platform detection: `platform = telegram | web`

### Testing Approach

При разработке новых фич:
1. Тестировать в обоих окружениях (Telegram + Browser)
2. Проверить responsive layout (mobile + desktop)
3. Проверить обе темы (light + dark)
4. Проверить все языки (хотя бы EN + RU)

### Code Style

- TypeScript strict mode
- ESLint + Prettier configured with lint-staged
- Commits run pre-commit hooks: lint + format
- Prefer functional components with hooks
- Use explicit types, avoid `any`
