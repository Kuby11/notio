import { TextSelection, type Transaction } from '@tiptap/pm/state';

/**
 * Turns the current text block into the official Tiptap Details node.
 *
 * Details consists of `detailsSummary` (the heading) and `detailsContent` (the body).
 * This matches Notion's toggle: the heading stays editable,
 * and child blocks can be collapsed. Plain `setNode` does not work because
 * Tiptap supports it only for textblock nodes.
 */
export function replaceTextblockWithDetails(
  transaction: Transaction,
  position = transaction.selection.from,
): boolean {
  const $from = transaction.doc.resolve(position);
  let depth = $from.depth;

  while (depth > 0 && !$from.node(depth).isTextblock) {
    depth -= 1;
  }

  if (depth === 0) {
    return false;
  }

  const current = $from.node(depth);
  const parent = $from.node(depth - 1);
  const index = $from.index(depth - 1);
  const detailsType = transaction.doc.type.schema.nodes['details'];
  const summaryType = transaction.doc.type.schema.nodes['detailsSummary'];
  const contentType = transaction.doc.type.schema.nodes['detailsContent'];
  const paragraphType = transaction.doc.type.schema.nodes['paragraph'];

  if (!detailsType || !summaryType || !contentType || !paragraphType) {
    return false;
  }

  // Do not replace the parent list: that would delete its siblings.
  if (!parent.canReplaceWith(index, index + 1, detailsType)) {
    return false;
  }

  const blockId = current.attrs['blockId'];
  const headerText = current.textContent;
  const summary = summaryType.create(
    null,
    headerText.length > 0 ? transaction.doc.type.schema.text(headerText) : undefined,
  );
  const body = contentType.create(null, [paragraphType.create()]);
  const details = detailsType.create(
    {
      ...(typeof blockId === 'string' && blockId.length > 0 ? { blockId } : {}),
      open: true,
    },
    [summary, body],
  );

  const start = $from.before(depth);
  const end = $from.after(depth);
  transaction.replaceWith(start, end, details);

  // Cursor at the end of the heading so typing can continue immediately.
  transaction.setSelection(TextSelection.create(transaction.doc, start + 2 + headerText.length));

  return true;
}
