import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/primitives/Button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/primitives/Sheet/Sheet';
import { subscriptionApi } from '@/api/subscription';
import { useAuthStore } from '@/store/auth';
import { staggerContainer, staggerItem } from '@/components/motion/transitions';

interface SupportHelperSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOtherQuestion: () => void;
}

const ShoppingCartIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-5.98.572m5.98-.572h9m-9 0a3 3 0 01-5.98.572M17.25 14.25a3 3 0 105.98.572m-5.98-.572h-9m9 0a3 3 0 015.98.572M3.75 5.25h16.5"
    />
  </svg>
);

const RefreshIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182"
    />
  </svg>
);

const LinkIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
    />
  </svg>
);

const PlusCircleIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const MinusCircleIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const WalletIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 013 6v3"
    />
  </svg>
);

const ChatIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
    />
  </svg>
);

export default function SupportHelperSheet({
  open,
  onOpenChange,
  onOtherQuestion,
}: SupportHelperSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions-for-helper'],
    queryFn: subscriptionApi.getSubscriptions,
    enabled: isAuthenticated && open,
    staleTime: 30000,
    retry: false,
  });

  const activeSubscription = subscriptions?.subscriptions?.find(
    (s) => s.status === 'active' || s.status === 'expiring',
  );

  const [showMemo, setShowMemo] = useState(false);

  const handleNavigate = (path: string, state?: Record<string, unknown>) => {
    onOpenChange(false);
    setShowMemo(false);
    navigate(path, state ? { state } : undefined);
  };

  const handleOtherQuestion = () => {
    setShowMemo(true);
  };

  const handleProceedToSupport = () => {
    onOpenChange(false);
    setShowMemo(false);
    onOtherQuestion();
  };

  const handleSheetChange = (open: boolean) => {
    if (!open) setShowMemo(false);
    onOpenChange(open);
  };

  const items = [
    {
      key: 'topUp',
      icon: <WalletIcon />,
      label: t('supportHelper.topUpBalance'),
      description: t('supportHelper.topUpBalanceDesc'),
      action: () => handleNavigate('/balance/top-up'),
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
    {
      key: 'buy',
      icon: <ShoppingCartIcon />,
      label: t('supportHelper.buySubscription'),
      description: t('supportHelper.buySubscriptionDesc'),
      action: () => handleNavigate('/subscriptions'),
      color: 'text-accent-400',
      bgColor: 'bg-accent-500/10',
    },
    {
      key: 'renew',
      icon: <RefreshIcon />,
      label: t('supportHelper.renewSubscription'),
      description: activeSubscription
        ? t('supportHelper.renewSubscriptionDesc')
        : t('supportHelper.noActiveSubscription'),
      action: activeSubscription
        ? () => handleNavigate(`/subscriptions/${activeSubscription.id}/renew`)
        : undefined,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      disabled: !activeSubscription,
    },
    {
      key: 'connect',
      icon: <LinkIcon />,
      label: t('supportHelper.connectDevice'),
      description: t('supportHelper.connectDeviceDesc'),
      action: () => handleNavigate('/connection'),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      key: 'addDevice',
      icon: <PlusCircleIcon />,
      label: t('supportHelper.addDevice'),
      description: activeSubscription
        ? t('supportHelper.addDeviceDesc')
        : t('supportHelper.noActiveSubscription'),
      action: activeSubscription
        ? () =>
            handleNavigate(`/subscriptions/${activeSubscription.id}`, {
              scrollToDevices: 'add',
            })
        : undefined,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10',
      disabled: !activeSubscription,
    },
    {
      key: 'reduceDevices',
      icon: <MinusCircleIcon />,
      label: t('supportHelper.reduceDevices'),
      description: activeSubscription
        ? t('supportHelper.reduceDevicesDesc')
        : t('supportHelper.noActiveSubscription'),
      action: activeSubscription
        ? () =>
            handleNavigate(`/subscriptions/${activeSubscription.id}`, {
              scrollToDevices: 'reduce',
            })
        : undefined,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      disabled: !activeSubscription,
    },
    {
      key: 'other',
      icon: <ChatIcon />,
      label: t('supportHelper.otherQuestion'),
      description: t('supportHelper.otherQuestionDesc'),
      action: handleOtherQuestion,
      color: 'text-dark-300',
      bgColor: 'bg-dark-700/50',
    },
  ];

  return (
    <Sheet open={open} onOpenChange={handleSheetChange}>
      <SheetContent>
        {showMemo ? (
          <>
            <SheetHeader>
              <SheetTitle>{t('supportHelper.memo.title')}</SheetTitle>
              <SheetDescription>{t('supportHelper.memo.subtitle')}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-3 pb-2">
              <div className="rounded-xl border border-warning-500/20 bg-warning-500/5 p-4">
                <ul className="space-y-2 text-sm text-dark-300">
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 text-warning-400">1.</span>
                    {t('supportHelper.memo.step1')}
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 text-warning-400">2.</span>
                    {t('supportHelper.memo.step2')}
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 text-warning-400">3.</span>
                    {t('supportHelper.memo.step3')}
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 text-warning-400">4.</span>
                    {t('supportHelper.memo.step4')}
                  </li>
                  <li className="flex gap-2">
                    <span className="flex-shrink-0 text-error-400">5.</span>
                    <span className="text-error-400">{t('supportHelper.memo.step5')}</span>
                  </li>
                </ul>
              </div>

              <Button onClick={handleProceedToSupport} fullWidth>
                {t('supportHelper.memo.proceed')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{t('supportHelper.title')}</SheetTitle>
              <SheetDescription>{t('supportHelper.subtitle')}</SheetDescription>
            </SheetHeader>

            <motion.div
              className="mt-4 space-y-2 pb-2"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              {items.map((item) => (
                <motion.button
                  key={item.key}
                  variants={staggerItem}
                  onClick={item.action}
                  disabled={item.disabled}
                  className={`flex w-full items-center gap-3 rounded-xl border border-dark-700/50 p-3 text-left transition-all ${
                    item.disabled
                      ? 'cursor-not-allowed opacity-50'
                      : 'hover:border-dark-600 hover:bg-dark-800/50 active:scale-[0.98]'
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${item.bgColor} ${item.color}`}
                  >
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-dark-100">{item.label}</div>
                    <div className="truncate text-xs text-dark-400">{item.description}</div>
                  </div>
                  <svg
                    className="h-4 w-4 flex-shrink-0 text-dark-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </motion.button>
              ))}
            </motion.div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
