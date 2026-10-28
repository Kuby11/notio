import { create } from 'zustand';

interface SidebarState {
  collapsed: boolean;
  /** Toggles the collapsed state (Ctrl+/). */
  toggle: () => void;
  /** Expands the sidebar (the topbar button of the page header). */
  open: () => void;
  /** Collapses the sidebar completely. */
  close: () => void;
}

/** Id of the panel element: the topbar toggle points at it with `aria-controls`. */
export const SIDEBAR_ID = 'app-sidebar';

/**
 * Collapsed state of the main sidebar.
 *
 * Shell UI state: the collapse button lives in the sidebar header, the reopen
 * button appears in the page topbar, so the state is shared and lives in a
 * store instead of the shell's props.
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  collapsed: false,
  toggle: () => set((state) => ({ collapsed: !state.collapsed })),
  open: () => set({ collapsed: false }),
  close: () => set({ collapsed: true }),
}));
