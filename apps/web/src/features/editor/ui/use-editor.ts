import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BlockContent } from '@notio/contracts';
import { useContainer } from '../../../core/container';

export const editorKeys = {
  all: (pageId: string) => ['editor', pageId] as const,
  document: (pageId: string) => [...editorKeys.all(pageId), 'document'] as const,
};

export function useDocument(pageId: string) {
  const { editor } = useContainer();

  return useQuery({
    queryKey: editorKeys.document(pageId),
    queryFn: () => editor.loadDocument.execute(pageId),
    staleTime: 30_000,
  });
}

export function useCreateBlock() {
  const { editor } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      pageId,
      content,
      afterBlockId,
    }: {
      pageId: string;
      content: BlockContent;
      afterBlockId?: string;
    }) => editor.insertBlock.execute(pageId, content, afterBlockId),
    onSuccess: async (_block, variables) => {
      await queryClient.invalidateQueries({ queryKey: editorKeys.document(variables.pageId) });
    },
  });
}

export function useUpdateBlock() {
  const { editor } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: BlockContent }) =>
      editor.updateBlock.execute(id, content),
    onSuccess: async (block: { pageId: string }) => {
      await queryClient.invalidateQueries({ queryKey: editorKeys.document(block.pageId) });
    },
  });
}

export function useDeleteBlock() {
  const { editor } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => editor.deleteBlock.execute(id),
    onSuccess: async () => {
      // Инвалидируем все документы: id блока не несёт pageId.
      await queryClient.invalidateQueries({ queryKey: ['editor'] });
    },
  });
}
