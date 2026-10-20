'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor as useTiptap, type Editor as TiptapEditor } from '@tiptap/react';
import { useEditor } from '../../hooks/use-editor';
import { blocksToEditorDocument, findBlockIdAtSelection } from '../../utils/block';
import type { SlashCommand } from '../../utils/slash';
import { EditorStatus } from '../private/editor-status';
import { editorExtensions } from '../private/editor-extensions';
import { applySlashCommand, findSlashTrigger } from '../private/slash-command';
import { SlashMenu, type SlashMenuPosition } from '../private/slash-menu';

interface EditorProps {
  pageId: string;
}

const SLASH_MENU_WIDTH = 320;
const SLASH_MENU_HEIGHT = 420;

/** Позиция меню у курсора с поправкой на края viewport. */
function getSlashPosition(editor: TiptapEditor, from: number): SlashMenuPosition {
  const coords = editor.view.coordsAtPos(from);
  const left = Math.max(8, Math.min(coords.left, window.innerWidth - SLASH_MENU_WIDTH - 8));
  const below = coords.bottom + 8;
  const top =
    below + SLASH_MENU_HEIGHT <= window.innerHeight
      ? below
      : Math.max(8, coords.top - SLASH_MENU_HEIGHT - 8);

  return { top, left };
}

/**
 * Редактор страницы на Tiptap.
 *
 * Компонент — только UI: документ, UI-состояние (выделение, slash-меню)
 * и операции с блоками приходят из единственного facade-хука `useEditor`.
 * Блоки гидратируются в JSON-документ Tiptap с blockId в attrs, поэтому
 * выделение и будущее автосохранение работают с id строк БД, а не с
 * позициями ProseMirror.
 */
export function Editor({ pageId }: EditorProps) {
  const {
    document: pageDocument,
    setSelectedBlock,
    slashMenuOpen,
    slashQuery,
    slashRange,
    openSlashMenu,
    closeSlashMenu,
  } = useEditor(pageId);
  const hydratedPageId = useRef<string | null>(null);
  const dismissedSlashFrom = useRef<number | null>(null);
  const [slashPosition, setSlashPosition] = useState<SlashMenuPosition | null>(null);

  const syncSlashMenu = useCallback(
    (currentEditor: TiptapEditor) => {
      const trigger = findSlashTrigger(currentEditor);

      if (!trigger) {
        dismissedSlashFrom.current = null;
        closeSlashMenu();
        return;
      }

      if (dismissedSlashFrom.current === trigger.range.from) {
        closeSlashMenu();
        return;
      }

      dismissedSlashFrom.current = null;
      openSlashMenu(trigger.query, trigger.range);
      setSlashPosition(getSlashPosition(currentEditor, trigger.range.from));
    },
    [closeSlashMenu, openSlashMenu],
  );

  const editor = useTiptap({
    extensions: editorExtensions,
    content: blocksToEditorDocument(pageDocument.data ?? []),
    // Редактор создаётся на клиенте: SSR-разметка Tiptap не должна
    // расходиться с первым клиентским рендером.
    immediatelyRender: false,
    onCreate: ({ editor: currentEditor }) => {
      setSelectedBlock(findBlockIdAtSelection(currentEditor.state));
      syncSlashMenu(currentEditor);
    },
    onUpdate: ({ editor: currentEditor }) => {
      syncSlashMenu(currentEditor);
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      setSelectedBlock(findBlockIdAtSelection(currentEditor.state));
      syncSlashMenu(currentEditor);
    },
  });

  useEffect(() => {
    if (!editor || !pageDocument.data) {
      return;
    }

    // Гидратация выполняется один раз на страницу. Повторный setContent
    // после инвалидации кеша сбросил бы курсор и несохранённые изменения.
    if (hydratedPageId.current === pageId) {
      return;
    }

    editor.commands.setContent(blocksToEditorDocument(pageDocument.data), { emitUpdate: false });
    hydratedPageId.current = pageId;
  }, [editor, pageId, pageDocument.data]);

  useEffect(() => {
    return () => closeSlashMenu();
  }, [closeSlashMenu]);

  const handleSlashClose = useCallback(() => {
    if (slashRange) {
      dismissedSlashFrom.current = slashRange.from;
    }

    closeSlashMenu();
  }, [closeSlashMenu, slashRange]);

  const handleSlashSelect = useCallback(
    (command: SlashCommand) => {
      if (!editor || !slashRange) {
        return;
      }

      const range = slashRange;
      dismissedSlashFrom.current = null;
      closeSlashMenu();
      applySlashCommand(editor, command, range);
    },
    [closeSlashMenu, editor, slashRange],
  );

  if (pageDocument.isPending) {
    return <EditorStatus>Загрузка документа…</EditorStatus>;
  }

  if (pageDocument.isError) {
    return <EditorStatus tone="error">Не удалось загрузить документ</EditorStatus>;
  }

  return (
    <div>
      <div className="prose max-w-none dark:prose-invert">
        <EditorContent editor={editor} />
      </div>
      {slashMenuOpen ? (
        <SlashMenu
          query={slashQuery}
          position={slashPosition}
          onSelect={handleSlashSelect}
          onClose={handleSlashClose}
        />
      ) : null}
    </div>
  );
}
