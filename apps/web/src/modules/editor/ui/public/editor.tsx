'use client';

import { useEditor as useTiptap, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { useDocument, useEditorUi } from '../../hooks/use-editor';
import { toEditorText } from '../../utils/block';
import { EditorStatus } from '../private/editor-status';

interface EditorProps {
  pageId: string;
}

/**
 * Редактор страницы на Tiptap.
 *
 * Компонент — только UI: документ приходит из facade-хука `useDocument`,
 * UI-состояние (выделение, slash-меню) — из `useEditorUi`.
 * Автосохранение через PATCH с debounce 1000 мс будет подключено в
 * facade-хуке модуля, а не здесь.
 */
export function Editor({ pageId }: EditorProps) {
  const document = useDocument(pageId);
  const { setSelectedBlock } = useEditorUi();

  const editor = useTiptap({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Начните писать или введите / для команд…' }),
    ],
    content: document.data ? toEditorText(document.data) : '',
    onSelectionUpdate: ({ editor: currentEditor }) => {
      setSelectedBlock(currentEditor.state.selection.anchor.toString());
    },
  });

  if (document.isPending) {
    return <EditorStatus>Загрузка документа…</EditorStatus>;
  }

  if (document.isError) {
    return <EditorStatus tone="error">Не удалось загрузить документ</EditorStatus>;
  }

  return (
    <div className="prose max-w-none dark:prose-invert">
      <EditorContent editor={editor} />
    </div>
  );
}
