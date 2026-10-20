'use client';

import {
  NodeViewContent,
  NodeViewWrapper,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import { Check } from 'lucide-react';

const PLACEHOLDER = 'Press / for commands';

function blockIdOf(node: NodeViewProps['node']): string | undefined {
  const blockId = node.attrs['blockId'];

  return typeof blockId === 'string' && blockId.length > 0 ? blockId : undefined;
}

/**
 * Кастомный чек-лист.
 *
 * Tiptap-схема остаётся прежней (`toDo` хранит `checked` и inline-текст),
 * поэтому маппинг в BlockContent и markdown-триггер `[]` не меняются.
 * React-компонент добавляет интерактивный чекбокс и визуальное зачёркивание
 * выполненной задачи.
 */
export function ToDoNodeView({ editor, getPos, node, updateAttributes }: NodeViewProps) {
  const checked = node.attrs['checked'] === true;

  const showPlaceholder = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => {
      if (node.content.size > 0) {
        return false;
      }

      const { selection } = currentEditor.state;
      const isAllSelected =
        !selection.empty &&
        selection.from === 0 &&
        selection.to === currentEditor.state.doc.content.size &&
        currentEditor.state.doc.textContent.length === 0;

      if (!selection.empty && !isAllSelected) {
        return false;
      }

      if (isAllSelected) {
        return true;
      }

      const position = getPos();

      return (
        typeof position === 'number' &&
        selection.from > position &&
        selection.from < position + node.nodeSize
      );
    },
  });

  return (
    <NodeViewWrapper
      data-block-type="to-do"
      data-block-id={blockIdOf(node)}
      data-checked={checked ? 'true' : 'false'}
      className="flex items-start gap-2"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={checked ? 'Снять отметку' : 'Отметить задачу'}
        contentEditable={false}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => updateAttributes({ checked: !checked })}
        className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40 text-transparent hover:border-muted-foreground'
        }`}
      >
        {checked ? <Check className="size-3" aria-hidden="true" /> : null}
      </button>

      <div className="relative min-w-0 flex-1">
        <NodeViewContent className={checked ? 'text-muted-foreground line-through' : undefined} />

        {showPlaceholder ? (
          <span className="text-muted-foreground pointer-events-none absolute top-0 left-0 text-sm leading-6">
            {PLACEHOLDER}
          </span>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}
