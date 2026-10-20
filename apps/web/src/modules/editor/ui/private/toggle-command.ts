import { TextSelection, type Transaction } from '@tiptap/pm/state';

/**
 * Превращает текущий текстовый блок в toggle-контейнер.
 *
 * Схема toggle — `paragraph block*`: первый абзац служит заголовком, остальные
 * узлы находятся в раскрывающемся теле. Обычный `setNode` не подходит, потому
 * что Tiptap поддерживает его только для textblock-узлов.
 */
export function replaceTextblockWithToggle(
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
  const toggleType = transaction.doc.type.schema.nodes['toggle'];
  const paragraphType = transaction.doc.type.schema.nodes['paragraph'];

  if (!toggleType || !paragraphType) {
    return false;
  }

  // Не заменяем родительский список: это удалило бы соседние элементы.
  if (!parent.canReplaceWith(index, index + 1, toggleType)) {
    return false;
  }

  const blockId = current.attrs['blockId'];
  const headerText = current.textContent;
  const header = paragraphType.create(
    null,
    headerText.length > 0 ? transaction.doc.type.schema.text(headerText) : undefined,
  );
  const body = paragraphType.create();
  const toggle = toggleType.create(
    {
      ...(typeof blockId === 'string' && blockId.length > 0 ? { blockId } : {}),
      open: true,
    },
    [header, body],
  );

  const start = $from.before(depth);
  const end = $from.after(depth);
  transaction.replaceWith(start, end, toggle);

  // Курсор — в конец заголовка, чтобы можно было сразу продолжать печатать.
  transaction.setSelection(TextSelection.create(transaction.doc, start + 2 + headerText.length));

  return true;
}
