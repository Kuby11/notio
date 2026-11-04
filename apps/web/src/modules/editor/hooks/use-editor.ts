'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Block, BlockContent, DatabaseViewType, Page } from '@notio/contracts';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useContainer } from '../../../core/container';
import { databaseKeys } from '../../databases';
import { pageKeys } from '../../pages';
import { useEditorStore } from '../stores/editor.store';
import type { CreateBlockFormInput } from '../types/ports';
import { AUTOSAVE_DELAY_MS, planAutosave, planMoves, type AutosavePlan } from '../utils/autosave';
import { editorDocumentToBlocks, type EditorDocument } from '../utils/block';
import { editorKeys } from '../utils/query-keys';

/** Autosave state: the indicator in the editor and the retry after an error. */
export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface Autosave {
  status: AutosaveStatus;
  error: Error | null;
  /** Queues the document: the send happens after AUTOSAVE_DELAY_MS. */
  schedule: (document: EditorDocument) => void;
}

/**
 * The single facade hook of the editor module.
 *
 * The document is server state in TanStack Query, the selection is a private
 * Zustand store, block access goes through the port from the container.
 * The editor component gets its data, operations and UI state from here.
 *
 * Autosave lives here too: changes are debounced for 1000 ms, then compared
 * with the loaded blocks and sent through the port as a diff. The component
 * only reports the current JSON document and knows nothing about the network.
 */
export function useEditor(pageId: string, workspaceId: string) {
  const { editor, pages, databases } = useContainer();
  const queryClient = useQueryClient();
  const selectedBlockId = useEditorStore((state) => state.selectedBlockId);
  const setSelectedBlock = useEditorStore((state) => state.setSelectedBlock);

  const document = useQuery({
    queryKey: editorKeys.document(pageId),
    queryFn: () => editor.listByPage(pageId),
    staleTime: 30_000,
  });

  // Page state: locked and trashed pages are both read-only. We read the same
  // detail key as the page header — the menu mutation invalidates pageKeys.all,
  // and both subscriptions refresh at once.
  const pageState = useQuery({
    queryKey: pageKeys.detail(workspaceId, pageId),
    queryFn: () => pages.getPage(pageId, workspaceId),
    select: (page) => ({ isLocked: page.isLocked === true, isTrashed: page.isTrashed }),
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
      // Invalidate every document: a block id carries no pageId.
      await queryClient.invalidateQueries({ queryKey: editorKeys.root });
    },
  });

  const moveBlock = useMutation({
    mutationFn: ({ id, afterBlockId }: { id: string; afterBlockId?: string }) =>
      editor.move(id, afterBlockId),
    onSettled: async () => {
      // Invalidate every document: a block id carries no pageId.
      await queryClient.invalidateQueries({ queryKey: editorKeys.root });
    },
  });

  // A sub-page is an ordinary page with parentId = the current one. The sidebar
  // tree refreshes through invalidation of the pages module keys.
  const createSubPage = useMutation({
    mutationFn: () => pages.create({ workspaceId, parentId: pageId, title: '' }),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(page.workspaceId) });
    },
  });

  /**
   * Creates the row behind a database block.
   *
   * The block is inserted immediately and gets its id when this resolves, so
   * the orchestration (row + optional chart view + sidebar invalidation) lives
   * here: the editor component must not know about the query cache or the
   * databases port.
   */
  const createDatabaseBlock = useCallback(
    async (input: {
      title: string;
      isInline: boolean;
      chartType?: DatabaseViewType;
      chartTitle?: string;
    }): Promise<{ id: string; title: string; viewId?: string }> => {
      const created = await databases.create({
        workspaceId,
        // Both kinds belong to the page they are inserted into, so the
        // sidebar tree shows them next to that page's child pages.
        parentId: pageId,
        title: input.title,
        isInline: input.isInline,
      });

      let viewId: string | undefined;

      // A chart block owns a dedicated view of its new database. The block
      // stores the view id, so the chart stays selected after reload.
      if (input.chartType) {
        const view = await databases.createView({
          databaseId: created.id,
          name: input.chartTitle ?? input.title,
          type: input.chartType,
          visiblePropertyIds: [],
        });

        viewId = view.id;
        await queryClient.invalidateQueries({ queryKey: databaseKeys.views(created.id) });
      }

      // The sidebar tree stays mounted: refresh its list so the new database
      // appears there too.
      await queryClient.invalidateQueries({ queryKey: databaseKeys.list(workspaceId) });

      return { id: created.id, title: created.title, viewId };
    },
    [databases, workspaceId, pageId, queryClient],
  );

  /** Title for a database link chip: the page keeps its name after renaming. */
  const getDatabaseBlock = useCallback(
    async (databaseId: string): Promise<{ id: string; title: string }> => {
      const database = await databases.get(databaseId);

      return { id: database.id, title: database.title };
    },
    [databases],
  );

  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [autosaveError, setAutosaveError] = useState<Error | null>(null);
  const savedBlocksRef = useRef<Block[] | null>(null);
  /** Temporary editor node ids -> ids assigned by the service on creation. */
  const blockIdsRef = useRef(new Map<string, string>());
  const pendingRef = useRef<EditorDocument | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const flushRef = useRef<() => Promise<void>>(async () => undefined);
  const pageIdRef = useRef(pageId);

  pageIdRef.current = pageId;

  // Changing the page starts autosave from a clean state.
  // The effect is declared before the cache sync: on mount it must not
  // wipe out the document that was already loaded.
  useEffect(() => {
    savedBlocksRef.current = null;
    blockIdsRef.current = new Map();
    pendingRef.current = null;
    setAutosaveStatus('idle');
    setAutosaveError(null);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [pageId]);

  useEffect(() => {
    if (document.data !== undefined) {
      savedBlocksRef.current = document.data;
    }
  }, [document.data]);

  const applyPlan = useCallback(
    async (plan: AutosavePlan) => {
      let blocks = savedBlocksRef.current ?? [];

      try {
        for (const id of plan.deletes) {
          await editor.delete(id);
          blocks = blocks.filter((block) => block.id !== id);
        }

        for (const update of plan.updates) {
          const updated = await editor.update(update.id, update.content);
          blocks = blocks.map((block) => (block.id === updated.id ? updated : block));
        }

        const createdIds = new Map<string, string>();

        // The service appends a block to the end of the page, so the order after
        // creation is restored by moves.
        for (const create of plan.creates) {
          const created = await editor.create(pageId, create.content);
          createdIds.set(create.clientId, created.id);
          blockIdsRef.current.set(create.clientId, created.id);
          blocks = [...blocks, created];
        }

        const finalOrder = plan.order.map((key) => createdIds.get(key) ?? key);
        const moves = planMoves(
          finalOrder,
          blocks.map((block) => block.id),
        );

        for (const move of moves) {
          const moved = await editor.move(move.id, move.afterBlockId);
          blocks = blocks.map((block) => (block.id === moved.id ? moved : block));
        }
      } finally {
        // The snapshot is refreshed even on a partial failure: the completed operations
        // are already on the server, and the next diff must be computed from them.
        // If another page was opened while the request ran, its state is left alone.
        if (pageIdRef.current === pageId) {
          const snapshot = blocks.toSorted((left, right) =>
            left.position < right.position ? -1 : left.position > right.position ? 1 : 0,
          );

          savedBlocksRef.current = snapshot;
          queryClient.setQueryData(editorKeys.document(pageId), snapshot);
        }
      }
    },
    [editor, pageId, queryClient],
  );

  // The server refreshes the page's updatedAt when blocks change, but invalidating
  // every pages query on each typing pause is expensive: patch the detail
  // cache directly so "edited N ago" in the header updates immediately.
  const markPageEdited = useCallback(() => {
    queryClient.setQueryData<Page>(pageKeys.detail(workspaceId, pageId), (old) =>
      old ? { ...old, updatedAt: new Date().toISOString() } : old,
    );
  }, [queryClient, workspaceId, pageId]);

  const flush = useCallback(async () => {
    if (savingRef.current) {
      return;
    }

    const documentJson = pendingRef.current;

    if (documentJson === null) {
      return;
    }

    pendingRef.current = null;
    savingRef.current = true;
    setAutosaveStatus('saving');

    try {
      const entries = editorDocumentToBlocks(documentJson).map((entry) =>
        entry.id === null
          ? entry
          : { id: blockIdsRef.current.get(entry.id) ?? entry.id, content: entry.content },
      );

      const plan = planAutosave(savedBlocksRef.current ?? [], entries);
      await applyPlan(plan);
      setAutosaveError(null);

      const planIsNotEmpty =
        plan.updates.length + plan.creates.length + plan.deletes.length + plan.order.length > 0;

      if (planIsNotEmpty) {
        markPageEdited();
      }

      if (pendingRef.current === null) {
        setAutosaveStatus('saved');
      }
    } catch (error) {
      // The document is not lost: the next change sends the full diff again.
      setAutosaveError(error instanceof Error ? error : new Error('Не удалось сохранить документ'));
      setAutosaveStatus('error');
    } finally {
      savingRef.current = false;

      if (pendingRef.current !== null) {
        await flushRef.current();
      }
    }
  }, [applyPlan]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const scheduleAutosave = useCallback((nextDocument: EditorDocument) => {
    pendingRef.current = nextDocument;
    setAutosaveStatus('pending');

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flushRef.current();
    }, AUTOSAVE_DELAY_MS);
  }, []);

  const autosave: Autosave = {
    status: autosaveStatus,
    error: autosaveError,
    schedule: scheduleAutosave,
  };

  return {
    document,
    isPageLocked: pageState.data?.isLocked ?? false,
    isPageTrashed: pageState.data?.isTrashed ?? false,
    selectedBlockId,
    setSelectedBlock,
    createBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    createSubPage,
    createDatabaseBlock,
    getDatabaseBlock,
    autosave,
  };
}
