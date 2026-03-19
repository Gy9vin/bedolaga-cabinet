import { create } from 'zustand';
import type { SelectedNode, NetworkFilters } from '@/types/referralNetwork';

const DEFAULT_FILTERS: NetworkFilters = {
  campaigns: [],
  partnersOnly: false,
  minReferrals: 0,
};

interface ReferralNetworkState {
  selectedNode: SelectedNode;
  hoveredNodeId: string | null;
  highlightedNodes: Set<string>;
  filters: NetworkFilters;
  isFiltersOpen: boolean;

  setSelectedNode: (node: SelectedNode) => void;
  setHoveredNode: (id: string | null) => void;
  setHighlightedNodes: (nodes: Set<string>) => void;
  updateFilters: (filters: Partial<NetworkFilters>) => void;
  resetFilters: () => void;
  setIsFiltersOpen: (open: boolean) => void;
}

export const useReferralNetworkStore = create<ReferralNetworkState>()((set) => ({
  selectedNode: null,
  hoveredNodeId: null,
  highlightedNodes: new Set<string>(),
  filters: { ...DEFAULT_FILTERS },
  isFiltersOpen: false,

  setSelectedNode: (node) => set({ selectedNode: node }),

  setHoveredNode: (id) => set({ hoveredNodeId: id }),

  setHighlightedNodes: (nodes) => set({ highlightedNodes: nodes }),

  updateFilters: (partial) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  setIsFiltersOpen: (open) => set({ isFiltersOpen: open }),
}));
