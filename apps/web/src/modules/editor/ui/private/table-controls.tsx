'use client';

import { GripVertical, Plus, X } from 'lucide-react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { selectionCell, isInTable } from '@tiptap/pm/tables';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../../shared/ui/tooltip';
import { moveTableColumn, moveTableRow } from '../../utils/table-actions';

/** Table position and focus inside it, restored from the DOM. */
interface TableFocus {
  tableEl: HTMLTableElement;
  rowIndex: number;
  colIndex: number;
}

type DragKind = 'row' | 'column';

interface DragState {
  kind: DragKind;
  from: number;
}

interface IndicatorState {
  kind: DragKind;
  index: number;
}

/**
 * Table overlay: pills above the column header and to the left of the row.
 *
 * A pill adds a row/column and removes the current one, while its handle
 * drags the whole row or column (HTML5 drag with an insert indicator line).
 * Positions are computed from the DOM on every render: scrolling and document
 * changes recalculate them through the listeners below.
 */
/** Icon button of the table pill with a shadcn tooltip. */
function PillButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" aria-label={label} onClick={onClick}>
            {children}
          </button>
        }
      />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function TableControls({ editor }: { editor: TiptapEditor }) {
  const t = useTranslations('editor.table');
  const [focus, setFocus] = useState<TableFocus | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [indicator, setIndicator] = useState<IndicatorState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const indicatorRef = useRef<IndicatorState | null>(null);

  dragRef.current = drag;
  indicatorRef.current = indicator;

  const readFocus = useCallback((): TableFocus | null => {
    // selectionCell throws RangeError outside a table — ask isInTable first.
    if (!isInTable(editor.state)) {
      return null;
    }

    const cell = selectionCell(editor.state);
    const cellNode = cell.nodeAfter;

    if (!cellNode || (cellNode.type.name !== 'tableCell' && cellNode.type.name !== 'tableHeader')) {
      return null;
    }

    const cellDom = editor.view.nodeDOM(cell.pos);

    if (!(cellDom instanceof HTMLTableCellElement)) {
      return null;
    }

    const rowDom = cellDom.parentElement;
    const tableEl = cellDom.closest('table');

    if (
      !(rowDom instanceof HTMLTableRowElement) ||
      !(tableEl instanceof HTMLTableElement) ||
      !tableEl.contains(rowDom)
    ) {
      return null;
    }

    return {
      tableEl,
      rowIndex: Array.prototype.indexOf.call(tableEl.rows, rowDom),
      colIndex: cellDom.cellIndex,
    };
  }, [editor]);

  useEffect(() => {
    const update = () => setFocus(readFocus());

    update();
    editor.on('transaction', update);
    window.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update);

    return () => {
      editor.off('transaction', update);
      window.removeEventListener('scroll', update, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', update);
    };
  }, [editor, readFocus]);

  const startDrag = useCallback((event: React.DragEvent, kind: DragKind, from: number) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', kind);
    setDrag({ kind, from });
  }, []);

  // Row/column dragging: insert indicator on dragover, move on drop.
  useEffect(() => {
    if (!drag || !focus) {
      return;
    }

    const { tableEl } = focus;

    const cleanup = () => {
      setDrag(null);
      setIndicator(null);
    };

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();

      const current = dragRef.current;

      if (!current) {
        return;
      }

      const target = document.elementFromPoint(event.clientX, event.clientY);
      const cell = target instanceof Element ? target.closest('td,th') : null;

      if (!(cell instanceof HTMLTableCellElement) || cell.closest('table') !== tableEl) {
        setIndicator(null);
        return;
      }

      const rect = cell.getBoundingClientRect();
      const afterPivot =
        current.kind === 'column'
          ? event.clientX > rect.left + rect.width / 2
          : event.clientY > rect.top + rect.height / 2;

      if (current.kind === 'column') {
        setIndicator({ kind: 'column', index: cell.cellIndex + (afterPivot ? 1 : 0) });
      } else {
        const rowIndex = Array.prototype.indexOf.call(tableEl.rows, cell.parentElement);

        setIndicator({ kind: 'row', index: Math.max(0, rowIndex) + (afterPivot ? 1 : 0) });
      }
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();

      const current = dragRef.current;
      const target = indicatorRef.current;

      if (!current || !target || target.kind !== current.kind) {
        cleanup();
        return;
      }

      // posAtDOM(table, 0) is the start of the table content: -1 gives the node position.
      const tablePos = editor.view.posAtDOM(tableEl, 0) - 1;

      if (current.kind === 'column') {
        moveTableColumn(editor, tablePos, current.from, target.index);
      } else {
        moveTableRow(editor, tablePos, current.from, target.index);
      }

      cleanup();
    };

    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDrop);
    document.addEventListener('dragend', cleanup);

    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDrop);
      document.removeEventListener('dragend', cleanup);
    };
  }, [drag, focus, editor]);

  // The pills are unnecessary on a locked page: the table is read-only.
  const isEditable = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => currentEditor.isEditable,
  });

  if (!focus || isEditable === false) {
    return null;
  }

  const { tableEl, rowIndex, colIndex } = focus;
  const row = tableEl.rows[rowIndex];

  if (!row) {
    return null;
  }

  const tableRect = tableEl.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();

  // The column rectangle is the union of its cells across all rows.
  let columnLeft = Number.POSITIVE_INFINITY;
  let columnRight = Number.NEGATIVE_INFINITY;

  for (const tableRow of Array.from(tableEl.rows)) {
    const cell = tableRow.cells[colIndex];

    if (!cell) {
      continue;
    }

    const rect = cell.getBoundingClientRect();

    columnLeft = Math.min(columnLeft, rect.left);
    columnRight = Math.max(columnRight, rect.right);
  }

  if (!Number.isFinite(columnLeft) || !Number.isFinite(columnRight)) {
    return null;
  }

  const columnCenter = (columnLeft + columnRight) / 2;

  return (
    <>
      {!drag && (
        <>
          <div
            className="notio-table-control"
            style={{
              top: Math.max(4, tableRect.top - 30),
              left: columnCenter - 36,
            }}
          >
            <span
              draggable
              role="button"
              tabIndex={0}
              aria-label={t('dragColumn')}
              title={t('dragColumnHint')}
              onDragStart={(event) => startDrag(event, 'column', colIndex)}
              className="notio-table-control-handle"
            >
              <GripVertical className="size-3" aria-hidden="true" />
            </span>
            <PillButton
              label={t('addColumnRight')}
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </PillButton>
            <PillButton
              label={t('deleteColumn')}
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <X className="size-3.5" aria-hidden="true" />
            </PillButton>
          </div>

          <div
            className="notio-table-control notio-table-control-row"
            style={{
              top: rowRect.top + rowRect.height / 2 - 12,
              left: Math.max(4, tableRect.left - 82),
            }}
          >
            <span
              draggable
              role="button"
              tabIndex={0}
              aria-label={t('dragRow')}
              title={t('dragRowHint')}
              onDragStart={(event) => startDrag(event, 'row', rowIndex)}
              className="notio-table-control-handle"
            >
              <GripVertical className="size-3" aria-hidden="true" />
            </span>
            <PillButton
              label={t('addRowBelow')}
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <Plus className="size-3.5" aria-hidden="true" />
            </PillButton>
            <PillButton
              label={t('deleteRow')}
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <X className="size-3.5" aria-hidden="true" />
            </PillButton>
          </div>
        </>
      )}

      {drag && indicator && indicator.kind === 'column' && (
        <div
          className="notio-table-drop-line notio-table-drop-line-column"
          style={{
            left: indicatorEdgeColumn(tableEl, indicator.index, tableRect),
            top: tableRect.top - 4,
            height: tableRect.height + 8,
          }}
        />
      )}

      {drag && indicator && indicator.kind === 'row' && (
        <div
          className="notio-table-drop-line notio-table-drop-line-row"
          style={{
            top: indicatorEdgeRow(tableEl, indicator.index, tableRect),
            left: tableRect.left - 4,
            width: tableRect.width + 8,
          }}
        />
      )}
    </>
  );
}

/** Left edge of the insert column: before column index, or the table's right edge. */
function indicatorEdgeColumn(tableEl: HTMLTableElement, index: number, tableRect: DOMRect): number {
  const firstRow = tableEl.rows[0];
  const cell = firstRow?.cells[index];

  return cell ? cell.getBoundingClientRect().left : tableRect.right;
}

/** Top edge of the insert row: before row index, or the table's bottom edge. */
function indicatorEdgeRow(tableEl: HTMLTableElement, index: number, tableRect: DOMRect): number {
  const row = tableEl.rows[index];

  return row ? row.getBoundingClientRect().top : tableRect.bottom;
}
