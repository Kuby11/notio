'use client';

import { DragHandle } from '@tiptap/extension-drag-handle-react';
import type { DragHandleRule, NestedOptions } from '@tiptap/extension-drag-handle';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { EditorContent, useEditor as useTiptap, type Editor as TiptapEditor } from '@tiptap/react';
import { shift, type ComputePositionConfig } from '@floating-ui/dom';
import { GripVertical, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor } from '../../hooks/use-editor';
import {
  blockBackgroundOf,
  blockColorOf,
  canColorBlock,
  canTurnInto,
  canUseMediaActions,
  currentTurnIntoOptionId,
  deleteBlockAt,
  downloadBlockFile,
  duplicateBlockAt,
  setBlockColors,
  startReplaceSource,
  turnIntoBlock,
  turnIntoOptionsFor,
  type TurnIntoOption,
} from '../../utils/block-actions';
import {
  findBlockAtPosition,
  firstTextblockPosition,
  insertBlockBelow,
} from '../../utils/block-insert';
import { blocksToEditorDocument, findBlockIdAtSelection } from '../../utils/block';
import { editorExtensions } from '../../utils/editor-extensions';
import {
  insertDatabaseBelow,
  insertDatabasePageBelow,
  setDatabaseBlockBridge,
} from '../../utils/database-block';
import { insertSubPageBelow, setSubPageBridge } from '../../utils/sub-page';
import { setMediaBridge } from '../../utils/media-bridge';
import { collectWorkspacePages, setPageLinkBridge } from '../../utils/page-link';
import { mediaFileUrl, useMedia } from '../../../media';
import { env } from '../../../../shared/configs/env';
import { useContainer } from '../../../../core/container';
import type { BlockColorPreset } from '@notio/contracts';
import type { SlashCommand } from '../../utils/slash';
import { BlockActionsMenu } from '../private/block-actions-menu';
import { AutosaveIndicator } from '../private/autosave-indicator';
import { EditorStatus } from '../private/editor-status';
import { SlashMenu } from '../private/slash-menu';
import { TableControls } from '../private/table-controls';
import { TextBubbleMenu } from '../private/text-bubble-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

interface EditorProps {
  pageId: string;
  /** Needed to create sub-pages and to follow their links. */
  workspaceId: string;
}

/** Blocks that span the full width while their content is centred by padding. */
const FULL_WIDTH_BLOCK_TYPES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'taskList',
  'details',
  'table',
  'databaseBlock',
]);

/**
 * The handle is aligned to the centre of the block: placement left (not left-start).
 *
 * shift({ crossAxis: true }) keeps the handle inside the visible area when the
 * block's centre leaves the bottom of the window (a tall block near the end of
 * the page): without it floating-ui centres the handle on the whole block and it
 * "detaches" from the visible part, staying off screen.
 *
 * A module-level constant is mandatory: DragHandle re-registers its
 * plugin when the identity of computePositionConfig changes, and registerPlugin
 * recreates the EditorState — the slash menu dies along with the Suggestion
 * state. An inline object here did that on every rerender.
 */
const DRAG_HANDLE_PLACEMENT: ComputePositionConfig = {
  placement: 'left',
  middleware: [shift({ crossAxis: true })],
};

/**
 * The official DragHandle must not catch the service Details wrappers: the
 * user drags the toggle itself or its child block, not detailsContent.
 *
 * Edge detection is off: by default it prefers the parent at the left
 * boundary. A nested block's handle sits right after that boundary, so while
 * moving towards it DragHandle had time to switch to the parent toggle.
 * Without edge detection the deeper child wins by depth.
 */
const DRAG_HANDLE_NESTED: NestedOptions = {
  edgeDetection: 'none',
  rules: [
    {
      id: 'excludeDetailsScaffolding',
      evaluate: ({ node }): number =>
        node.type.name === 'detailsSummary' || node.type.name === 'detailsContent' ? 1000 : 0,
    } satisfies DragHandleRule,
  ],
};

export function Editor({ pageId, workspaceId }: EditorProps) {
  const t = useTranslations('editor');
  const {
    document: pageDocument,
    isPageLocked,
    isPageTrashed,
    setSelectedBlock,
    autosave,
    createSubPage,
    createDatabaseBlock,
    getDatabaseBlock,
  } = useEditor(pageId, workspaceId);
  const { upload: uploadMediaFile } = useMedia();
  const router = useRouter();
  const hydratedPageId = useRef<string | null>(null);
  const [, setHoveredBlockPos] = useState<number | null>(null);
  const [subPageError, setSubPageError] = useState(false);
  const [databaseError, setDatabaseError] = useState(false);
  // A whole-page database opens only after autosave stores the link chip:
  // navigating earlier would unmount the editor and lose the insert.
  const [pendingDatabaseId, setPendingDatabaseId] = useState<string | null>(null);
  const hoveredBlockPosRef = useRef<number | null>(null);
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<ReturnType<typeof useTiptap> | null>(null);
  const isDraggingRef = useRef(false);
  const dragHandleRafRef = useRef<number | null>(null);
  const [blockMenu, setBlockMenu] = useState<{ open: boolean; pos: number | null }>({
    open: false,
    pos: null,
  });
  const [actionsMenu, setActionsMenu] = useState<{ open: boolean; pos: number | null }>({
    open: false,
    pos: null,
  });

  const editor = useTiptap({
    extensions: editorExtensions,
    content: blocksToEditorDocument(pageDocument.data ?? []),
    // The editor is created on the client: Tiptap's SSR markup must not
    // diverge from the first client render.
    immediatelyRender: false,
    onCreate: ({ editor: currentEditor }) => {
      setSelectedBlock(findBlockIdAtSelection(currentEditor.state));
    },
    onUpdate: ({ editor: currentEditor }) => {
      setSelectedBlock(findBlockIdAtSelection(currentEditor.state));
      // Before hydration the document is transiently empty: autosaving that
      // state would wipe the page's entire server-rendered content.
      if (hydratedPageId.current !== pageId) {
        return;
      }

      autosave.schedule(currentEditor.getJSON());
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      setSelectedBlock(findBlockIdAtSelection(currentEditor.state));
    },
  });

  // Locked or trashed page: content is read-only. While the state loads we
  // edit as usual — false arrives after loading.
  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(isPageLocked !== true && isPageTrashed !== true);
  }, [editor, isPageLocked, isPageTrashed]);

  useEffect(() => {
    if (!editor || !pageDocument.data) {
      return;
    }

    // Hydration runs once per page. A repeated setContent
    // after a cache invalidation would reset the cursor and unsaved changes.
    if (hydratedPageId.current === pageId) {
      return;
    }

    const content = blocksToEditorDocument(pageDocument.data);

    // Tiptap's React nodes (TaskItem/Details) mount through flushSync.
    // Calling setContent straight from useEffect lands in React's lifecycle and prints
    // the warning "flushSync was called from inside a lifecycle method".
    // We defer hydration to the next task, when the commit is already done.
    const hydrationTimer = setTimeout(() => {
      if (editor.isDestroyed) {
        return;
      }

      editor.commands.setContent(content, { emitUpdate: false });

      const firstTextblock = firstTextblockPosition(editor.state.doc, -1);

      if (firstTextblock !== null) {
        const $position = editor.state.doc.resolve(firstTextblock);
        if ($position.parent.isTextblock && $position.parent.textContent === '') {
          editor.commands.setTextSelection(firstTextblock);
        }
      }

      hydratedPageId.current = pageId;
      hoveredBlockPosRef.current = null;
      setHoveredBlockPos(null);
      setBlockMenu({ open: false, pos: null });
      setActionsMenu({ open: false, pos: null });
    }, 0);

    return () => clearTimeout(hydrationTimer);
  }, [editor, pageId, pageDocument.data]);

  /**
   * An open menu at the handle locks DragHandle (meta lockDragHandle):
   * otherwise the plugin hides the handle on mouseleave out of the editor and the
   * anchor of the open popover disappears — Base UI would jump to the top-left
   * corner of the page. We dispatch only on state change: the meta transaction
   * does not touch the document and does not wake autosave.
   */
  const handleLockedRef = useRef(false);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const locked = blockMenu.open || actionsMenu.open;

    if (handleLockedRef.current === locked) {
      return;
    }

    handleLockedRef.current = locked;
    editor.view.dispatch(
      editor.state.tr.setMeta('lockDragHandle', locked).setMeta('addToHistory', false),
    );
  }, [editor, blockMenu.open, actionsMenu.open]);

  /**
   * DragHandle does not follow scrolling: after a scroll the handle stayed at the
   * old coordinates — "floating" in the middle of the visible area, detached from
   * its block (report: for blocks at the bottom edge the handle ended up in the
   * middle of the window). We hide the handle on editor scroll; the next mousemove
   * shows it next to the actual block. An open menu is left alone — its anchor
   * is pinned by the lockDragHandle meta.
   */
  const menusOpenRef = useRef(false);
  menusOpenRef.current = blockMenu.open || actionsMenu.open;

  useEffect(() => {
    if (!editor) {
      return;
    }

    const hideHandleOnScroll = (event: Event) => {
      if (menusOpenRef.current) {
        return;
      }

      if (!(event.target instanceof Node) || !editor.view.dom.contains(event.target)) {
        return;
      }

      editor.view.dispatch(
        editor.state.tr.setMeta('hideDragHandle', true).setMeta('addToHistory', false),
      );
    };

    document.addEventListener('scroll', hideHandleOnScroll, true);

    return () => document.removeEventListener('scroll', hideHandleOnScroll, true);
  }, [editor]);

  /**
   * posAtCoords over atomic media blocks: the browser's caret logic rounds
   * "after" a replaced element at any point inside it, so DragHandle cannot find
   * the block and clicks yield a position strictly after it.
   * For points inside the vertical range of a media block we return the position
   * "before" it — deterministic, with no reliance on browser behaviour.
   */
  useEffect(() => {
    editorRef.current = editor ?? null;

    if (!editor) {
      return;
    }

    const view = editor.view;
    const original = view.posAtCoords.bind(view);
    const mediaTypes = new Set(['image', 'video', 'file', 'emoji']);

    view.posAtCoords = (coords: { left: number; top: number }) => {
      const result = original(coords);

      if (!result) {
        return result;
      }

      const $pos = editor.state.doc.resolve(result.pos);
      const before = $pos.nodeBefore;

      if (!before || !mediaTypes.has(before.type.name)) {
        return result;
      }

      const mediaPos = result.pos - before.nodeSize;
      const dom = view.nodeDOM(mediaPos);

      if (!(dom instanceof HTMLElement)) {
        return result;
      }

      const rect = dom.getBoundingClientRect();

      if (coords.top < rect.top - 1 || coords.top > rect.bottom + 1) {
        return result;
      }

      return { pos: mediaPos, inside: result.inside };
    };
  }, [editor]);

  // Mutation and router change between renders: keep fresh references in a ref,
  // so the bridge into the editor's storage is assigned once per instance.
  const createSubPageRef = useRef(createSubPage);
  createSubPageRef.current = createSubPage;
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (pendingDatabaseId === null || autosave.status !== 'saved') {
      return;
    }

    setPendingDatabaseId(null);
    routerRef.current.push(
      `/workspaces/${workspaceId}/databases/${pendingDatabaseId}` as Parameters<
        typeof routerRef.current.push
      >[0],
    );
  }, [pendingDatabaseId, autosave.status, workspaceId]);

  /**
   * Bridge for sub-pages: editor extensions create a page and follow its
   * link without knowing about the network or the router. It binds to a specific
   * editor instance and lives as long as the editor (see utils/sub-page).
   */
  useEffect(() => {
    if (!editor) {
      return;
    }

    setSubPageBridge(editor, {
      createSubPage: async () => {
        setSubPageError(false);

        try {
          const page = await createSubPageRef.current.mutateAsync();

          return { id: page.id, title: page.title, icon: page.icon ?? null };
        } catch {
          setSubPageError(true);

          return null;
        }
      },
      openSubPage: (targetPageId: string) => {
        void routerRef.current.push(`/workspaces/${workspaceId}/${targetPageId}`);
      },
    });
  }, [editor, workspaceId]);

  /**
   * Bridge for media blocks: the image/video/file node views upload
   * files through the media facade hook and build public gateway URLs.
   */
  const uploadMediaRef = useRef(uploadMediaFile);
  uploadMediaRef.current = uploadMediaFile;

  useEffect(() => {
    if (!editor) {
      return;
    }

    setMediaBridge(editor, {
      uploadFile: (file) => uploadMediaRef.current(workspaceId, file),
      fileUrl: (fileId, download) => mediaFileUrl(fileId, env.NEXT_PUBLIC_GATEWAY_URL, download),
    });
  }, [editor, workspaceId]);

  /**
   * Bridge for page links and breadcrumbs: the node views need page data
   * and navigation, but ReactRenderer renders them outside the application
   * tree — context and hooks do not reach it (see utils/page-link).
   */
  const { pages } = useContainer();
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  // Fresh references per render without making the bridge effect depend on
  // them: re-registering the bridge on every keystroke recreated the editor's
  // plugin state.
  const createDatabaseBlockRef = useRef(createDatabaseBlock);
  createDatabaseBlockRef.current = createDatabaseBlock;
  const getDatabaseBlockRef = useRef(getDatabaseBlock);
  getDatabaseBlockRef.current = getDatabaseBlock;

  /**
   * Bridge for database blocks: the block is inserted immediately, while the
   * database row is created through the databases port by the React layer.
   */
  useEffect(() => {
    if (!editor) {
      return;
    }

    setDatabaseBlockBridge(editor, {
      workspaceId,
      createDatabase: async (kind, chartType) => {
        setDatabaseError(false);

        try {
          return await createDatabaseBlockRef.current({
            title: t('databaseBlock.defaultTitle'),
            isInline: kind === 'inline',
            chartType,
            chartTitle: t('databaseBlock.chartTitle'),
          });
        } catch {
          setDatabaseError(true);

          return null;
        }
      },
      getDatabase: async (databaseId) => {
        try {
          return await getDatabaseBlockRef.current(databaseId);
        } catch {
          return null;
        }
      },
      openDatabase: (databaseId) => {
        void routerRef.current.push(
          `/workspaces/${workspaceId}/databases/${databaseId}` as Parameters<
            typeof routerRef.current.push
          >[0],
        );
      },
      openCreatedDatabase: (databaseId) => {
        setPendingDatabaseId(databaseId);
      },
    });
  }, [editor, workspaceId, t]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    setPageLinkBridge(editor, {
      workspaceId,
      currentPageId: pageId,
      getPage: (targetPageId) => pagesRef.current.getPage(targetPageId, workspaceId),
      listPages: () => collectWorkspacePages(pagesRef.current, workspaceId),
      // href is built by the view nodes; the Route type is inferred from the template literals,
      // a dynamic string is cast to it explicitly.
      navigate: (href) =>
        routerRef.current.push(href as Parameters<typeof routerRef.current.push>[0]),
    });
  }, [editor, workspaceId, pageId]);

  /** Clicking a sub-page link opens the page, as in Notion. */
  const handleContainerClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as Node | null;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest('[data-block-type="page"]');

      if (!(link instanceof HTMLElement)) {
        return;
      }

      const targetPageId = link.getAttribute('data-page-id');

      if (targetPageId) {
        event.preventDefault();
        routerRef.current.push(`/workspaces/${workspaceId}/${targetPageId}`);
      }
    },
    [workspaceId],
  );

  /**
   * The official DragHandle reacts only to mousemove inside
   * editor.view.dom. To show the handle while the cursor is outside
   * ProseMirror but still over the editor area (empty gaps,
   * padding around blocks and so on), we forward external mouse movements to
   * editor.view.dom. Coordinates are clamped inside the plugin itself, so a
   * cursor left/right of a block still highlights the nearest block.
   */
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleGlobalMouseMove = (event: MouseEvent) => {
      const editorInstance = editorRef.current;

      if (!editorInstance || isDraggingRef.current || !editorContainerRef.current) {
        return;
      }

      const viewDom = editorInstance.view.dom;

      // Inside ProseMirror the official plugin already handles movement.
      if (viewDom.contains(event.target as Node | null)) {
        return;
      }

      const containerRect = editorContainerRef.current.getBoundingClientRect();

      // Only over the editor area — not across the whole page.
      if (
        event.clientX < containerRect.left - 1 ||
        event.clientX > containerRect.right + 1 ||
        event.clientY < containerRect.top - 1 ||
        event.clientY > containerRect.bottom + 1
      ) {
        return;
      }

      if (dragHandleRafRef.current !== null) {
        cancelAnimationFrame(dragHandleRafRef.current);
      }

      dragHandleRafRef.current = requestAnimationFrame(() => {
        dragHandleRafRef.current = null;

        const currentEditor = editorRef.current;
        if (!currentEditor || isDraggingRef.current) {
          return;
        }

        const targetDom = currentEditor.view.dom;
        targetDom.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: event.clientX,
            clientY: event.clientY,
            view: window,
          }),
        );
      });
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      if (dragHandleRafRef.current !== null) {
        cancelAnimationFrame(dragHandleRafRef.current);
      }

      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, []);

  /**
   * Keeps the target block from "jumping" to its parent when the cursor leaves
   * the content into the drag handle zone (left of the block).
   *
   * On mousemove the official plugin calls findBestDragTarget → posAtCoords.
   * At coordinates left of a nested block's content posAtCoords may resolve
   * into detailsContent/parent, and the handle hops to the parent toggle. We
   * intercept movement in the handle zone and substitute an event with
   * coordinates inside the current block so the target never changes.
   */
  useEffect(() => {
    if (!editor) {
      return;
    }

    const viewDom = editor.view.dom;
    let rafId: number | null = null;

    const protectCurrentBlock = (event: MouseEvent) => {
      const pos = hoveredBlockPosRef.current;
      if (pos === null) {
        return;
      }

      const blockDom = editor.view.nodeDOM(pos);
      if (!(blockDom instanceof HTMLElement)) {
        return;
      }

      const rect = blockDom.getBoundingClientRect();
      const style = getComputedStyle(blockDom);
      const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
      const contentLeft = rect.left + paddingLeft;

      // The handle sits at the left-start of the block's content zone. We guard the strip
      // left of the content (where the handle is) and a small overlap inside the block.
      const zoneLeft = contentLeft - 52;
      const zoneRight = contentLeft + 16;
      const zoneTop = rect.top - 4;
      const zoneBottom = rect.bottom + 4;

      if (
        event.clientX < zoneLeft ||
        event.clientX > zoneRight ||
        event.clientY < zoneTop ||
        event.clientY > zoneBottom
      ) {
        return;
      }

      event.stopImmediatePropagation();

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        rafId = null;
        const currentEditor = editorRef.current ?? editor;
        currentEditor.view.dom.dispatchEvent(
          new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: contentLeft + 4,
            clientY: event.clientY,
            view: window,
          }),
        );
      });
    };

    viewDom.addEventListener('mousemove', protectCurrentBlock, { capture: true });

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      viewDom.removeEventListener('mousemove', protectCurrentBlock, { capture: true });
    };
  }, [editor]);

  const handleNodeChange = useCallback(
    ({ node, pos }: { node: ProseMirrorNode | null; pos: number }) => {
      if (!editor || !node) {
        hoveredBlockPosRef.current = null;
        setHoveredBlockPos(null);
        return;
      }

      const blockPos = findBlockAtPosition(editor, pos)?.pos ?? null;

      hoveredBlockPosRef.current = blockPos;
      setHoveredBlockPos(blockPos);
    },
    [editor],
  );

  /**
   * Full-width blocks position the handle by their content-box rather than the
   * border-box. Otherwise the drag handle drifts to the far left edge of the editor.
   */
  const getReferencedVirtualElement = useCallback(() => {
    if (!editor || hoveredBlockPosRef.current === null) {
      return null;
    }

    const pos = hoveredBlockPosRef.current;
    const node = editor.state.doc.nodeAt(pos);

    if (!node || !FULL_WIDTH_BLOCK_TYPES.has(node.type.name)) {
      return null;
    }

    const dom = editor.view.nodeDOM(pos);

    if (!(dom instanceof HTMLElement) || dom.parentElement !== editor.view.dom) {
      return null;
    }

    const rect = dom.getBoundingClientRect();
    const style = getComputedStyle(dom);
    const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(style.paddingRight) || 0;
    const left = rect.left + paddingLeft;
    const right = rect.right - paddingRight;

    if (right <= left) {
      return null;
    }

    return {
      getBoundingClientRect: () => new DOMRect(left, rect.top, right - left, rect.height),
    };
  }, [editor]);

  const handleBlockMenuClose = useCallback(() => {
    setBlockMenu({ open: false, pos: null });
  }, []);

  const handleBlockMenuSelect = useCallback(
    (command: SlashCommand) => {
      const menu = blockMenu;

      setBlockMenu({ open: false, pos: null });

      if (!editor || !menu.open || menu.pos === null) {
        return;
      }

      const block = findBlockAtPosition(editor, menu.pos);

      if (!block) {
        return;
      }

      // A sub-page is created asynchronously: the node is inserted immediately, and pageId
      // appears after the service responds.
      if (command.kind === 'page') {
        void insertSubPageBelow(editor, block);
      } else if (command.kind === 'database') {
        // The same for a database: the row is created after the node is placed.
        void insertDatabaseBelow(editor, block);
      } else if (command.kind === 'databasePage') {
        // Full-page database: a link chip is placed and then opened.
        void insertDatabasePageBelow(editor, block);
      } else if (command.kind === 'chart') {
        // Chart block: create an inline database with this chart view.
        void insertDatabaseBelow(editor, block, command.chartType);
      } else {
        insertBlockBelow(editor, block, command);
      }

      setHoveredBlockPos(null);
    },
    [blockMenu, editor],
  );

  const handleActionsClose = useCallback(() => {
    setActionsMenu({ open: false, pos: null });
  }, []);

  /** Runs a menu action on the block and closes the popover. */
  const runBlockAction = useCallback(
    (
      apply: (
        currentEditor: TiptapEditor,
        block: NonNullable<ReturnType<typeof findBlockAtPosition>>,
      ) => void,
    ) => {
      const menu = actionsMenu;

      setActionsMenu({ open: false, pos: null });

      if (!editor || !menu.open || menu.pos === null) {
        return;
      }

      const block = findBlockAtPosition(editor, menu.pos);

      if (block) {
        apply(editor, block);
      }
    },
    [actionsMenu, editor],
  );

  const handleActionTurnInto = useCallback(
    (option: TurnIntoOption) => {
      runBlockAction((currentEditor, block) => {
        turnIntoBlock(currentEditor, block, option);
      });
    },
    [runBlockAction],
  );

  const handleActionColor = useCallback(
    (color: BlockColorPreset | null) => {
      runBlockAction((currentEditor, block) => {
        setBlockColors(currentEditor, block, { color });
      });
    },
    [runBlockAction],
  );

  const handleActionBackground = useCallback(
    (background: BlockColorPreset | null) => {
      runBlockAction((currentEditor, block) => {
        setBlockColors(currentEditor, block, { backgroundColor: background });
      });
    },
    [runBlockAction],
  );

  const handleActionDelete = useCallback(() => {
    runBlockAction((currentEditor, block) => {
      deleteBlockAt(currentEditor, block);
    });
  }, [runBlockAction]);

  const handleActionDuplicate = useCallback(() => {
    runBlockAction((currentEditor, block) => {
      duplicateBlockAt(currentEditor, block);
    });
  }, [runBlockAction]);

  const handleActionReplace = useCallback(() => {
    runBlockAction((currentEditor, block) => {
      startReplaceSource(currentEditor, block);
    });
  }, [runBlockAction]);

  const handleActionDownload = useCallback(() => {
    runBlockAction((currentEditor, block) => {
      downloadBlockFile(currentEditor, block);
    });
  }, [runBlockAction]);

  // The block the action menu is open over: one lookup instead of five in the JSX.
  const actionsBlock =
    actionsMenu.open && actionsMenu.pos !== null && editor
      ? findBlockAtPosition(editor, actionsMenu.pos)
      : null;

  if (pageDocument.isPending) {
    return <EditorStatus>{t('loadingDocument')}</EditorStatus>;
  }

  if (pageDocument.isError) {
    return <EditorStatus tone="error">{t('loadFailed')}</EditorStatus>;
  }

  return (
    <div
      className="relative"
      ref={editorContainerRef}
      data-editor-container=""
      onClick={handleContainerClick}
    >
      <AutosaveIndicator status={autosave.status} />

      <div className="prose max-w-none dark:prose-invert">
        <EditorContent editor={editor} />
      </div>

      {subPageError && <EditorStatus tone="error">{t('subPageFailed')}</EditorStatus>}

      {databaseError && <EditorStatus tone="error">{t('databaseBlock.failed')}</EditorStatus>}

      {autosave.status === 'error' && <EditorStatus tone="error">{t('saveFailed')}</EditorStatus>}

      {editor && (
        <DragHandle
          editor={editor}
          pluginKey="notioBlockDragHandle"
          nested={DRAG_HANDLE_NESTED}
          computePositionConfig={DRAG_HANDLE_PLACEMENT}
          className="notio-block-handle"
          onNodeChange={handleNodeChange}
          getReferencedVirtualElement={getReferencedVirtualElement}
          onElementDragStart={() => {
            setBlockMenu({ open: false, pos: null });
            setActionsMenu({ open: false, pos: null });
            isDraggingRef.current = true;
          }}
          onElementDragEnd={() => {
            isDraggingRef.current = false;
          }}
        >
          <Popover
            open={blockMenu.open}
            onOpenChange={(open) => {
              // The block position is fixed at the moment the menu opens: hoveredBlockPos
              // lives in a ref and stays current while the handle is visible.
              setBlockMenu({ open, pos: open ? hoveredBlockPosRef.current : null });
            }}
          >
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={t('dragHandle.addBelow')}
                  aria-expanded={blockMenu.open}
                  className={`text-muted-foreground hover:bg-accent hover:text-foreground flex size-6 items-center justify-center rounded transition-colors ${
                    blockMenu.open ? 'bg-accent text-foreground' : ''
                  }`}
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              }
            />
            {blockMenu.open && blockMenu.pos !== null ? (
              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={6}
                className="w-auto p-1"
                onClick={(event) => event.stopPropagation()}
              >
                <SlashMenu
                  query=""
                  onSelect={handleBlockMenuSelect}
                  onClose={handleBlockMenuClose}
                />
              </PopoverContent>
            ) : null}
          </Popover>

          <Popover
            open={actionsMenu.open}
            onOpenChange={(open) => {
              setActionsMenu({ open, pos: open ? hoveredBlockPosRef.current : null });
            }}
          >
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={t('dragHandle.blockActions')}
                  aria-expanded={actionsMenu.open}
                  className={`text-muted-foreground hover:bg-accent hover:text-foreground flex size-6 cursor-grab touch-none items-center justify-center rounded transition-colors active:cursor-grabbing ${
                    actionsMenu.open ? 'bg-accent text-foreground' : ''
                  }`}
                >
                  <GripVertical className="size-4" aria-hidden="true" />
                </button>
              }
            />
            {actionsMenu.open && actionsBlock ? (
              <PopoverContent
                side="bottom"
                align="start"
                sideOffset={6}
                className="w-auto p-1"
                onClick={(event) => event.stopPropagation()}
              >
                <BlockActionsMenu
                  canTurnInto={canTurnInto(actionsBlock.node)}
                  canColor={canColorBlock(actionsBlock.node)}
                  turnIntoOptions={turnIntoOptionsFor(actionsBlock.node)}
                  currentTurnIntoId={currentTurnIntoOptionId(actionsBlock)}
                  currentColor={blockColorOf(actionsBlock.node)}
                  currentBackground={blockBackgroundOf(actionsBlock.node)}
                  canReplace={
                    actionsBlock.node.type.name === 'image' && canUseMediaActions(actionsBlock.node)
                  }
                  canDownload={canUseMediaActions(actionsBlock.node)}
                  onTurnInto={handleActionTurnInto}
                  onSetColor={handleActionColor}
                  onSetBackground={handleActionBackground}
                  onReplace={handleActionReplace}
                  onDownload={handleActionDownload}
                  onDelete={handleActionDelete}
                  onDuplicate={handleActionDuplicate}
                  onClose={handleActionsClose}
                />
              </PopoverContent>
            ) : null}
          </Popover>
        </DragHandle>
      )}

      {editor && <TableControls editor={editor} />}

      {editor && <TextBubbleMenu editor={editor} />}
    </div>
  );
}
