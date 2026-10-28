import { create } from 'zustand';

/**
 * Editor UI state: the selected block.
 *
 * Server data (blocks) is never stored here — UI state only.
 * Zustand for UI, TanStack Query for data: the boundary holds.
 */
interface EditorState {
  selectedBlockId: string | null;
  setSelectedBlock: (id: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedBlockId: null,
  setSelectedBlock: (id) => set({ selectedBlockId: id }),
}));
