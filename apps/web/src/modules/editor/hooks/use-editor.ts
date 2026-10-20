import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BlockContent } from '@notio/contracts';
import { useContainer } from '../../../core/container';
import { useEditorStore } from '../stores/editor.store';
import type { CreateBlockFormInput } from '../types/ports';
import { editorKeys } from '../utils/query-keys';

/**
 * Единственный facade-хук модуля редактора.
 *
 * Документ — серверное состояние TanStack Query, выделение и slash-меню —
 * приватный Zustand-стор, обращения к блокам — через порт из контейнера.
 * Компонент редактора получает отсюда и данные, и операции, и UI-состояние.
 */
export function useEditor(pageId: string) {
  const { editor } = useContainer();
  const queryClient = useQueryClient();
  const selectedBlockId = useEditorStore((state) => state.selectedBlockId);
  const slashMenuOpen = useEditorStore((state) => state.slashMenuOpen);
  const slashQuery = useEditorStore((state) => state.slashQuery);
  const slashRange = useEditorStore((state) => state.slashRange);
  const setSelectedBlock = useEditorStore((state) => state.setSelectedBlock);
  const openSlashMenu = useEditorStore((state) => state.openSlashMenu);
  const closeSlashMenu = useEditorStore((state) => state.closeSlashMenu);

  const document = useQuery({
    queryKey: editorKeys.document(pageId),
    queryFn: () => editor.listByPage(pageId),
    staleTime: 30_000,
  });

  const createBlock = useMutation({
    mutationFn: ({ pageId: targetPageId, content, afterBlockId }: CreateBlockFormInput) =>
      editor.create(targetPageId, content, afterBlockId),
    onSuccess: async (_block, variables) => {
      await queryClient.invalidateQueries({ queryKey: editorKeys.document(variables.pageId) });
    },
  });

  const updateBlock = useMutation({
    mutationFn: ({ id, content }: { id: string; content: BlockContent }) =>
      editor.update(id, content),
    onSuccess: async (block) => {
      await queryClient.invalidateQueries({ queryKey: editorKeys.document(block.pageId) });
    },
  });

  const deleteBlock = useMutation({
    mutationFn: (id: string) => editor.delete(id),
    onSuccess: async () => {
      // Инвалидируем все документы: id блока не несёт pageId.
      await queryClient.invalidateQueries({ queryKey: editorKeys.root });
    },
  });

  const moveBlock = useMutation({
    mutationFn: ({ id, afterBlockId }: { id: string; afterBlockId?: string }) =>
      editor.move(id, afterBlockId),
    onSettled: async () => {
      // Инвалидируем все документы: id блока не несёт pageId.
      await queryClient.invalidateQueries({ queryKey: editorKeys.root });
    },
  });

  return {
    document,
    selectedBlockId,
    slashMenuOpen,
    slashQuery,
    slashRange,
    setSelectedBlock,
    openSlashMenu,
    closeSlashMenu,
    createBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
  };
}
