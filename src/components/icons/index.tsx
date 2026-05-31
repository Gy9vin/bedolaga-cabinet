import type { CSSProperties } from 'react';
import {
  PiArrowLeft,
  PiArrowRight,
  PiArrowsClockwise,
  PiCaretDown,
  PiCaretRight,
  PiChartBar,
  PiChatCircle,
  PiCheck,
  PiClipboardText,
  PiClock,
  PiCopy,
  PiCreditCard,
  PiDownloadSimple,
  PiGameController,
  PiGearSix,
  PiGift,
  PiGlobe,
  PiHardDrives,
  PiHouse,
  PiInfo,
  PiList,
  PiLock,
  PiMagnifyingGlass,
  PiMegaphone,
  PiMoon,
  PiPalette,
  PiPauseCircle,
  PiPencil,
  PiPencilSimple,
  PiPlay,
  PiPlus,
  PiShield,
  PiSignOut,
  PiSparkle,
  PiStar,
  PiStarFill,
  PiDiceFive,
  PiStop,
  PiSun,
  PiTrash,
  PiUploadSimple,
  PiUser,
  PiUsers,
  PiWallet,
  PiX,
} from 'react-icons/pi';

import { cn } from '@/lib/utils';

// Re-export the extended Phosphor icon sets so the whole cabinet imports the
// panel's icon family from a single barrel.
export * from './extended-icons';
export * from './editor-icons';

interface IconProps {
  className?: string;
}

/**
 * Cabinet icons are thin wrappers over the Remnawave panel's own icon library
 * (Phosphor, via `react-icons/pi`, regular weight). Each export keeps the
 * historical name + default Tailwind sizing so every consumer keeps working,
 * while the cabinet now renders the exact icon set the panel uses instead of
 * hand-written SVGs.
 *
 * react-icons components inherit `currentColor` and accept `className`, so
 * Tailwind size (`h-5 w-5`) and text-color utilities control them as before.
 */

// Navigation & Layout
export const HomeIcon = ({ className }: IconProps) => (
  <PiHouse className={cn('h-5 w-5', className)} />
);

export const BackIcon = ({ className }: IconProps) => (
  <PiArrowLeft className={cn('h-5 w-5', className)} />
);

export const ChevronRightIcon = ({ className }: IconProps) => (
  <PiCaretRight className={cn('h-5 w-5', className)} />
);

export const MenuIcon = ({ className }: IconProps) => (
  <PiList className={cn('h-5 w-5', className)} />
);

export const CloseIcon = ({ className }: IconProps) => <PiX className={cn('h-5 w-5', className)} />;

export const ChevronDownIcon = ({ className }: IconProps) => (
  <PiCaretDown className={cn('h-5 w-5', className)} />
);

export const ArrowRightIcon = ({ className }: IconProps) => (
  <PiArrowRight className={cn('h-5 w-5', className)} />
);

// Actions
export const SearchIcon = ({ className }: IconProps) => (
  <PiMagnifyingGlass className={cn('h-5 w-5', className)} />
);

export const PlusIcon = ({ className }: IconProps) => (
  <PiPlus className={cn('h-5 w-5', className)} />
);

export const EditIcon = ({ className }: IconProps) => (
  <PiPencilSimple className={cn('h-4 w-4', className)} />
);

export const PencilIcon = ({ className }: IconProps) => (
  <PiPencil className={cn('h-4 w-4', className)} />
);

export const TrashIcon = ({ className }: IconProps) => (
  <PiTrash className={cn('h-5 w-5', className)} />
);

export const UploadIcon = ({ className }: IconProps) => (
  <PiUploadSimple className={cn('h-5 w-5', className)} />
);

export const DownloadIcon = ({ className }: IconProps) => (
  <PiDownloadSimple className={cn('h-5 w-5', className)} />
);

export const RefreshIcon = ({
  className,
  spinning = false,
}: IconProps & { spinning?: boolean }) => (
  <PiArrowsClockwise className={cn('h-4 w-4', spinning && 'animate-spin', className)} />
);

export const SyncIcon = ({ className }: IconProps) => (
  <PiArrowsClockwise className={cn('h-5 w-5', className)} />
);

// Status
export const CheckIcon = ({ className }: IconProps) => (
  <PiCheck className={cn('h-4 w-4', className)} />
);

export const CopyIcon = ({ className }: IconProps) => (
  <PiCopy className={cn('h-4 w-4', className)} />
);

export const XIcon = ({ className }: IconProps) => <PiX className={cn('h-4 w-4', className)} />;

export const LockIcon = ({ className }: IconProps) => (
  <PiLock className={cn('h-4 w-4', className)} />
);

export const InfoIcon = ({ className }: IconProps) => (
  <PiInfo className={cn('h-5 w-5', className)} />
);

// User & People
export const UserIcon = ({ className }: IconProps) => (
  <PiUser className={cn('h-5 w-5', className)} />
);

export const UsersIcon = ({ className }: IconProps) => (
  <PiUsers className={cn('h-5 w-5', className)} />
);

export const LogoutIcon = ({ className }: IconProps) => (
  <PiSignOut className={cn('h-5 w-5', className)} />
);

// Theme
export const SunIcon = ({ className }: IconProps) => <PiSun className={cn('h-5 w-5', className)} />;

export const MoonIcon = ({ className }: IconProps) => (
  <PiMoon className={cn('h-5 w-5', className)} />
);

export const PaletteIcon = ({ className }: IconProps) => (
  <PiPalette className={cn('h-5 w-5', className)} />
);

// Features & Content
export const SubscriptionIcon = ({ className }: IconProps) => (
  <PiSparkle className={cn('h-5 w-5', className)} />
);

export const WalletIcon = ({ className }: IconProps) => (
  <PiWallet className={cn('h-5 w-5', className)} />
);

export const ChatIcon = ({ className }: IconProps) => (
  <PiChatCircle className={cn('h-5 w-5', className)} />
);

export const GiftIcon = ({ className }: IconProps) => (
  <PiGift className={cn('h-4 w-4', className)} />
);

export const ClockIcon = ({ className }: IconProps) => (
  <PiClock className={cn('h-5 w-5', className)} />
);

export const StarIcon = ({ className, filled }: IconProps & { filled?: boolean }) =>
  filled ? (
    <PiStarFill className={cn('h-5 w-5', className)} />
  ) : (
    <PiStar className={cn('h-5 w-5', className)} />
  );

export const GamepadIcon = ({ className }: IconProps) => (
  <PiGameController className={cn('h-5 w-5', className)} />
);

export const ClipboardIcon = ({ className }: IconProps) => (
  <PiClipboardText className={cn('h-5 w-5', className)} />
);

export const CogIcon = ({ className }: IconProps) => (
  <PiGearSix className={cn('h-5 w-5', className)} />
);

export const WheelIcon = ({ className }: IconProps) => (
  <PiDiceFive className={cn('h-5 w-5', className)} />
);

export const ShieldIcon = ({ className }: IconProps) => (
  <PiShield className={cn('h-5 w-5', className)} />
);

export const ServerIcon = ({ className }: IconProps) => (
  <PiHardDrives className={cn('h-5 w-5', className)} />
);

export const CampaignIcon = ({ className }: IconProps) => (
  <PiMegaphone className={cn('h-5 w-5', className)} />
);

// Brand mark — the genuine Remnawave panel logo (kept as-is, this is the
// panel's own SVG, not a hand-drawn substitute).
export const RemnawaveIcon = ({ className }: IconProps) => (
  <svg
    className={cn('h-5 w-5', className)}
    fill="none"
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      clipRule="evenodd"
      d="M8 1a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-1.5 0V1.75A.75.75 0 0 1 8 1Zm6 2a.75.75 0 0 1 .75.75v8.5a.75.75 0 0 1-1.5 0v-8.5A.75.75 0 0 1 14 3ZM5 4a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0v-6.5A.75.75 0 0 1 5 4Zm6 1a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 11 5ZM2 6a.75.75 0 0 1 .75.75v2.5a.75.75 0 0 1-1.5 0v-2.5A.75.75 0 0 1 2 6Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

export const ChartIcon = ({ className }: IconProps) => (
  <PiChartBar className={cn('h-4 w-4', className)} />
);

export const GlobeIcon = ({ className }: IconProps) => (
  <PiGlobe className={cn('h-5 w-5', className)} />
);

export const PlayIcon = ({ className }: IconProps) => (
  <PiPlay className={cn('h-4 w-4', className)} />
);

export const StopIcon = ({ className }: IconProps) => (
  <PiStop className={cn('h-4 w-4', className)} />
);

export const ArrowPathIcon = ({ className }: IconProps) => (
  <PiArrowsClockwise className={cn('h-4 w-4', className)} />
);

export const PauseIcon = ({ className, style }: IconProps & { style?: CSSProperties }) => (
  <PiPauseCircle className={cn('h-5 w-5', className)} style={style} />
);

export const CreditCardIcon = ({ className }: IconProps) => (
  <PiCreditCard className={cn('h-5 w-5', className)} />
);
