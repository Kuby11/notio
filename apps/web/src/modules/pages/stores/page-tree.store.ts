import { create } from 'zustand';

/**
 * UI state for the page tree: which nodes are expanded.
 *
 * Server data is not stored here — only UI state.
 * Zustand for UI, TanStack Query for data: the boundary is respected.
 */
interface PageTreeState {
  expanded: Record<string, boolean>;
  toggle: (id: string) => void;
  setExpanded: (id: string, expanded: boolean) => void;
  reset: () => void;
}

export const usePageTreeStore = create<PageTreeState>((set) => ({
  expanded: {},
  toggle: (id) => set((state) => ({ expanded: { ...state.expanded, [id]: !state.expanded[id] } })),
  setExpanded: (id, expanded) =>
    set((state) => ({ expanded: { ...state.expanded, [id]: expanded } })),
  reset: () => set({ expanded: {} }),
}));
