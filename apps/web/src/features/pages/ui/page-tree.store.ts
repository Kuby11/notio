import { create } from 'zustand';

/**
 * UI-состояние дерева страниц: какие узлы развёрнуты.
 *
 * Серверные данные здесь не хранятся — только состояние интерфейса.
 * Zustand для UI, TanStack Query для данных: граница не нарушается.
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
