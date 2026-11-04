import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BlockContent } from '@notio/contracts';
import { useContainer } from '../../../core/container';
import { editorKeys } from '../utils/query-keys';

/**
 * Creating blocks outside the open document (Markdown import in settings).
 *
 * useEditor loads the document of a specific page, while an import writes blocks
 * into a page that is not open yet — hence a separate mutation without the
 * document query.
 */
export function useBlockCreator() {
  const { editor } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pageId, content }: { pageId: string; content: BlockContent }) =>
      editor.create(pageId, content),
    onSuccess: async (block) => {
      await queryClient.invalidateQueries({ queryKey: editorKeys.document(block.pageId) });
    },
  });
}
