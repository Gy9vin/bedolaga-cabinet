import { create } from 'zustand';

/**
 * Ephemeral override for MobileBottomNav's active tab.
 *
 * Normally the active tab is derived from location.pathname. Some result
 * screens (SimplePaymentPending, SimplePaymentSuccess) live at a URL that
 * doesn't match any simple-mode tab (/balance/top-up/result), so they use
 * this store to highlight the tab their UX flow logically belongs to.
 *
 * Screens must clear the override on unmount via setNavActivePath(null).
 */
interface NavActiveOverrideState {
  activePath: string | null;
  setNavActivePath: (path: string | null) => void;
}

export const useNavActiveOverrideStore = create<NavActiveOverrideState>((set) => ({
  activePath: null,
  setNavActivePath: (path) => set({ activePath: path }),
}));
