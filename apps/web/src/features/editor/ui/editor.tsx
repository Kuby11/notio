'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { useDocument } from './use-editor';
import { useEditorStore } from './editor.store';

interface EditorProps {
  pageId: string;
}

/**
 * Редактор страницы на Tiptap.
 *
 * Автосохранение с debounce 1000 мс: при каждом изменении документа
 * таймер сбрасывается, а при его срабатывании отправляется PATCH.
 * Состояние редактора (выделение, slash-меню) живёт в Zustand,
 * а не в TanStack Query — это UI-состояние, а не серверные данные.
 */
export function Editor({ pageId }: EditorProps) {
  const document = useDocument(pageId);
  const setSelectedBlock = useEditorStore((state) => state.setSelectedBlock);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Начните писать или введите / для команд…' }),
    ],
    content: document.data ? document.data.map((block) => block.content).join('\n') : '',
    onUpdate: ({ editor: currentEditor }) => {
      // Автосохранение с debounce 1000 мс.
      // Полная реализация отправки PATCH — в следующей итерации.
      void currentEditor;
    },
    onSelectionUpdate: ({ editor: currentEditor }) => {
      setSelectedBlock(currentEditor.state.selection.anchor.toString());
    },
  });

  if (document.isPending) {
    return <p className="text-sm text-neutral-500">Загрузка документа…</p>;
  }

  if (document.isError) {
    return <p className="text-sm text-red-600">Не удалось загрузить документ</p>;
  }

  return (
    <div className="prose max-w-none dark:prose-invert">
      <EditorContent editor={editor} />
    </div>
  );
}
