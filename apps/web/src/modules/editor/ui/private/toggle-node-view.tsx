'use client';

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { ChevronRight } from 'lucide-react';
import type { KeyboardEvent } from 'react';

function blockIdOf(node: NodeViewProps['node']): string | undefined {
  const blockId = node.attrs['blockId'];

  return typeof blockId === 'string' && blockId.length > 0 ? blockId : undefined;
}

/**
 * Toggle-контейнер: заголовок и сворачиваемое тело живут в одном
 * ProseMirror-узле. Первый дочерний абзац — заголовок, остальные блоки —
 * содержимое, которое скрывается при `open: false`.
 */
export function ToggleNodeView({ node, updateAttributes }: NodeViewProps) {
  const open = node.attrs['open'] !== false;

  return (
    <NodeViewWrapper
      data-block-type="toggle"
      data-block-id={blockIdOf(node)}
      data-open={open ? 'true' : 'false'}
      className="notion-toggle"
      onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
        // Enter в закрытом заголовке Notion трактует как создание ребёнка.
        // Открываем контейнер, чтобы новая строка не осталась невидимой.
        if (event.key === 'Enter' && !open) {
          updateAttributes({ open: true });
        }
      }}
    >
      <button
        type="button"
        aria-label={open ? 'Свернуть переключатель' : 'Развернуть переключатель'}
        aria-expanded={open}
        contentEditable={false}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => updateAttributes({ open: !open })}
        className="notion-toggle-arrow"
      >
        <ChevronRight
          className={`size-4 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>

      <NodeViewContent className="notion-toggle-content" />
    </NodeViewWrapper>
  );
}
