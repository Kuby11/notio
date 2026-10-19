'use client';

import { useEffect, useRef } from 'react';
import { EditorContent, useEditor as useTiptap } from '@tiptap/react';
import { useEditor } from '../../hooks/use-editor';
import { blocksToEditorDocument, findBlockIdAtSelection } from '../../utils/block';
import { EditorStatus } from '../private/editor-status';
import { editorExtensions } from '../private/editor-extensions';

interface EditorProps {
  pageId: string;
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
  const { document: pageDocument, setSelectedBlock } = useEditor(pageId);
  const hydratedPageId = useRef<string | null>(null);

  const editor = useTiptap({
    extensions: editorExtensions,
    content: blocksToEditorDocument(pageDocument.data ?? []),
    // Редактор создаётся на клиенте: SSR-разметка Tiptap не должна
    // расходиться с первым клиентским рендером.
    immediatelyRender: false,
    onCreate: ({ editor: currentEditor }) => {
      setSelectedBlock(findBlockIdAtSelection(currentEditor.state));
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      setSelectedBlock(findBlockIdAtSelection(currentEditor.state));
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

  if (pageDocument.isPending) {
    return <EditorStatus>Загрузка документа…</EditorStatus>;
  }

  if (pageDocument.isError) {
    return <EditorStatus tone="error">Не удалось загрузить документ</EditorStatus>;
  }

  return (
    <div className="prose max-w-none dark:prose-invert">
      <EditorContent editor={editor} />
    </div>
  );
}
