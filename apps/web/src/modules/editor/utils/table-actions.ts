import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Fragment } from '@tiptap/pm/model';
import { TextSelection, type Transaction } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';

/**
 * Перестановка строк и колонок таблицы. В prosemirror-tables этой версии
 * нет команд moveRow/moveColumn, поэтому таблица пересобирается целиком
 * одной транзакцией: attrs ячеек (colwidth) и строк (rowHeight) переезжают
 * вместе с ними. Вставка/удаление строк и колонок делают официальные
 * команды addRowAfter / addColumnAfter / deleteRow / deleteColumn.
 */

function childrenOf(node: ProseMirrorNode): ProseMirrorNode[] {
  const children: ProseMirrorNode[] = [];

  node.forEach((child) => {
    children.push(child);
  });

  return children;
}

/** Переставляет элемент массива на позицию вставки insertionIndex. */
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

/** Курсор — в первую ячейку строки rowIndex, колонку colIndex. */
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

  // offset — перед целевой ячейкой; +2 попадает в её первый textblock.
  transaction.setSelection(TextSelection.near(transaction.doc.resolve(offset + 2)));
}

/** Переставляет строку таблицы; insertionIndex — позиция вставки. */
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

/** Переставляет колонку таблицы во всех строках; insertionIndex — позиция вставки. */
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
