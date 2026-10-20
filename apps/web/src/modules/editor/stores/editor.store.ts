import { create } from 'zustand';
import type { SlashRange } from '../utils/slash';

/**
 * UI-состояние редактора: выделенный блок, открытый slash-меню.
 *
 * Серверные данные (блоки) здесь не хранятся — только состояние интерфейса.
 * Zustand для UI, TanStack Query для данных: граница не нарушается.
 */
interface EditorState {
  selectedBlockId: string | null;
  slashMenuOpen: boolean;
  slashQuery: string;
  slashRange: SlashRange | null;
  setSelectedBlock: (id: string | null) => void;
  openSlashMenu: (query: string, range: SlashRange) => void;
  closeSlashMenu: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  selectedBlockId: null,
  slashMenuOpen: false,
  slashQuery: '',
  slashRange: null,
  setSelectedBlock: (id) => set({ selectedBlockId: id }),
  openSlashMenu: (query, range) => {
    const state = get();

    if (
      state.slashMenuOpen &&
      state.slashQuery === query &&
      state.slashRange?.from === range.from &&
      state.slashRange.to === range.to
    ) {
      return;
    }

    set({ slashMenuOpen: true, slashQuery: query, slashRange: range });
  },
  closeSlashMenu: () => {
    const state = get();

    if (!state.slashMenuOpen && state.slashQuery === '' && state.slashRange === null) {
      return;
    }

    set({ slashMenuOpen: false, slashQuery: '', slashRange: null });
  },
}));
