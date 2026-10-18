import { create } from 'zustand';

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
  setSelectedBlock: (id: string | null) => void;
  openSlashMenu: (query: string) => void;
  closeSlashMenu: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedBlockId: null,
  slashMenuOpen: false,
  slashQuery: '',
  setSelectedBlock: (id) => set({ selectedBlockId: id }),
  openSlashMenu: (query) => set({ slashMenuOpen: true, slashQuery: query }),
  closeSlashMenu: () => set({ slashMenuOpen: false, slashQuery: '' }),
}));
