import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Fragment } from '@tiptap/pm/model';
import { TextSelection, type Transaction } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';

/**
 * Reordering table rows and columns. This version of prosemirror-tables
 * has no moveRow/moveColumn commands, so the table is rebuilt entirely in
 * one transaction: cell (colwidth) and row (rowHeight) attrs move
 * along with them. Inserting and deleting rows/columns uses the official
 * addRowAfter / addColumnAfter / deleteRow / deleteColumn commands.
 */

function childrenOf(node: ProseMirrorNode): ProseMirrorNode[] {
  const children: ProseMirrorNode[] = [];

  node.forEach((child) => {
    children.push(child);
  });

  return children;
}

/** Moves an array element to the insertionIndex position. */
function moveTo<T>(items: T[], from: number, insertionIndex: number): T[] {
  if (from === insertionIndex || from === insertionIndex - 1) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);
  const target = insertionIndex > from ? insertionIndex - 1 : insertionIndex;

  if (moved !== undefined) {
    next.splice(target, 0, moved);
  }

  return next;
}

/** Puts the cursor in the first cell of rowIndex/colIndex. */
function selectCell(
  transaction: Transaction,
  tablePos: number,
  rows: ProseMirrorNode[],
  rowIndex: number,
  colIndex: number,
): void {
  let offset = tablePos + 1;

  for (let index = 0; index < rowIndex && index < rows.length; index += 1) {
    offset += rows[index]?.nodeSize ?? 0;
  }

  const cells = rows[rowIndex] ? childrenOf(rows[rowIndex]) : [];

  for (let index = 0; index < colIndex && index < cells.length; index += 1) {
    offset += cells[index]?.nodeSize ?? 0;
  }

  // offset points before the target cell; +2 lands in its first textblock.
  transaction.setSelection(TextSelection.near(transaction.doc.resolve(offset + 2)));
}

/** Moves a table row; insertionIndex is the insertion position. */
export function moveTableRow(
  editor: Editor,
  tablePos: number,
  from: number,
  insertionIndex: number,
): boolean {
  const table = editor.state.doc.nodeAt(tablePos);

  if (!table || table.type.name !== 'table') {
    return false;
  }

  const rows = childrenOf(table);
  const reordered = moveTo(rows, from, insertionIndex);

  if (reordered === rows) {
    return false;
  }

  const transaction = editor.state.tr.replaceWith(
    tablePos + 1,
    tablePos + table.nodeSize - 1,
    reordered,
  );

  const targetIndex = insertionIndex > from ? insertionIndex - 1 : insertionIndex;

  selectCell(transaction, tablePos, reordered, targetIndex, 0);
  editor.view.dispatch(transaction.scrollIntoView());

  return true;
}

/** Moves a table column across all rows; insertionIndex is the insertion position. */
export function moveTableColumn(
  editor: Editor,
  tablePos: number,
  from: number,
  insertionIndex: number,
): boolean {
  const table = editor.state.doc.nodeAt(tablePos);

  if (!table || table.type.name !== 'table') {
    return false;
  }

  const rows = childrenOf(table);
  const anyRow = rows[0];

  if (!anyRow || childrenOf(anyRow).length <= from) {
    return false;
  }

  const cellGroups = rows.map((row) => childrenOf(row));
  const reorderedGroups = cellGroups.map((cells) => moveTo(cells, from, insertionIndex));

  if (cellGroups.every((cells, index) => reorderedGroups[index] === cells)) {
    return false;
  }

  const reorderedRows: ProseMirrorNode[] = [];

  rows.forEach((row, index) => {
    const cells = reorderedGroups[index] ?? [];

    reorderedRows.push(row.copy(Fragment.fromArray(cells)));
  });

  const transaction = editor.state.tr.replaceWith(
    tablePos + 1,
    tablePos + table.nodeSize - 1,
    reorderedRows,
  );

  const targetIndex = insertionIndex > from ? insertionIndex - 1 : insertionIndex;
  const targetRow = Math.min(targetIndex, reorderedRows.length - 1);

  selectCell(transaction, tablePos, reorderedRows, targetRow, targetIndex);
  editor.view.dispatch(transaction.scrollIntoView());

  return true;
}
