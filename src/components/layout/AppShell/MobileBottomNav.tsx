import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { usePlatform } from '@/platform';
import { useUiMode } from '@/hooks/useUiMode';

// Icons
import {
  HomeIcon,
  SubscriptionIcon,
  WalletIcon,
  UsersIcon,
  ChatIcon,
  WheelIcon,
  UserIcon,
} from './icons';

interface MobileBottomNavProps {
  isKeyboardOpen: boolean;
  referralEnabled?: boolean;
  wheelEnabled?: boolean;
}

export function MobileBottomNav({
  isKeyboardOpen,
  referralEnabled,
  wheelEnabled,
}: MobileBottomNavProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const { haptic } = usePlatform();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  // Core navigation items for bottom bar.
  //
  // Support is ALWAYS present in the full interface — frustrated paying
  // customers must find help in the primary nav, not in the hamburger
  // drawer. Previously Wheel (a brand-moment surface) displaced Support
  // (a critical-path surface) when the wheel feature flag was on; that
  // trade is hostile to the support-user persona and was flagged by the
  // /impeccable critique.
  //
  // In the simple mode the tabbar is cut down to four sections and Support
  // is one of the items that leaves it — this is intentional, not a
  // regression of the rule above. Support stays reachable via the header
  // in both modes (ticket notification bell in AppHeader, plus the command
  // palette) — neither is filtered by simple mode. There is no Support entry
  // in Profile; adding one is out of scope here and belongs to the profile
  // screen rework planned for a later wave.
  //
  // Wheel and Referral are shown INDEPENDENTLY: when both feature flags are
  // on, BOTH appear in the bar (operator wants referral reachable in the
  // bottom nav without turning the wheel off). Support stays last and is
  // always present. With both enabled the bar has 6 items — the flex layout
  // (flex-1, min-w-56px) keeps them evenly sized on phone widths.
  const coreItems = [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscriptions', label: t('nav.subscription'), icon: SubscriptionIcon },
    { path: '/balance', label: t('nav.balance'), icon: WalletIcon },
    ...(wheelEnabled ? [{ path: '/wheel', label: t('nav.wheel'), icon: WheelIcon }] : []),
    ...(referralEnabled ? [{ path: '/referral', label: t('nav.referral'), icon: UsersIcon }] : []),
    { path: '/support', label: t('nav.support'), icon: ChatIcon },
  ];

  // Простой таббар — явный список из четырёх разделов, а не фильтрация
  // coreItems сверху. Профиль в полном режиме живёт в гамбургер-меню и в
  // coreItems никогда не появляется, поэтому filterNavForSimpleMode (умеет
  // только убирать пункты) не мог бы его туда добавить — отсюда пропавший
  // четвёртый пункт таббара в простом режиме. referralEnabled по-прежнему
  // может выключить раздел рефералов — тогда таббар остаётся из трёх.
  const simpleItems = [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscriptions', label: t('nav.subscription'), icon: SubscriptionIcon },
    ...(referralEnabled ? [{ path: '/referral', label: t('nav.referral'), icon: UsersIcon }] : []),
    { path: '/profile', label: t('nav.profile'), icon: UserIcon },
  ];

  const { isSimple } = useUiMode();
  const visibleCoreItems = isSimple ? simpleItems : coreItems;

  const handleNavClick = () => {
    haptic.impact('light');
  };

  return (
    <nav
      className={cn(
        'fixed z-50 transition-all duration-200 lg:hidden',
        'bg-dark-900/95 backdrop-blur-linear',
        'border border-dark-700/30',
        isKeyboardOpen ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
      style={{
        bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        left: '16px',
        right: '16px',
        borderRadius: 'var(--bento-radius, 24px)',
        padding: '8px 4px',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset',
      }}
    >
      <div className="flex justify-around">
        {visibleCoreItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={cn(
              'relative flex min-w-[56px] flex-1 shrink-0 flex-col items-center justify-center rounded-2xl px-3 py-2.5 transition-all duration-200',
              isActive(item.path) ? 'text-accent-400' : 'text-dark-400 hover:text-dark-200',
            )}
          >
            {isActive(item.path) && (
              <motion.div
                layoutId="bottom-nav-active"
                className="absolute inset-0 rounded-2xl bg-accent-500/15"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <item.icon className="relative z-10 h-5 w-5" />
            <span className="relative z-10 mt-1 whitespace-nowrap text-2xs">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
