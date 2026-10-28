import { create } from 'zustand';

/** The settings section that was open last (for reopening the dialog). */
export type SettingsSectionId = 'profile' | 'preferences' | 'workspaces' | 'import';

interface SettingsState {
  open: boolean;
  section: SettingsSectionId;
  openSettings: (section?: SettingsSectionId) => void;
  close: () => void;
}

/**
 * UI state of the settings dialog: the sidebar profile and other places open
 * it without pushing props through the whole tree.
 */
export const useSettingsStore = create<SettingsState>((set) => ({
  open: false,
  section: 'profile',
  openSettings: (section) => set((state) => ({ open: true, section: section ?? state.section })),
  close: () => set({ open: false }),
}));
