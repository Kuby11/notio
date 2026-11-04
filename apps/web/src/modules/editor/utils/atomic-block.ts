import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import type { EditorBlockLocation } from './block-insert';
import type { SlashRange } from './slash';

/**
 * Placement of contentless atomic blocks (sub-page links, inline databases).
 *
 * Both the slash command and the plus menu insert through here, so the node
 * always gets a paragraph after it (the cursor can leave the atom) and a list
 * is left first (an atom inside listItem would be lost on serialisation).
 */

const LIST_WRAPPER_TYPES = new Set(['bulletList', 'orderedList', 'taskList']);

/** Inserts the atom plus a paragraph after it and puts the cursor in it. */
function insertNodes(editor: Editor, position: number, nodes: ProseMirrorNode[]): void {
  const transaction = editor.state.tr.insert(position, nodes);
  const paragraphPosition = position + (nodes[0]?.nodeSize ?? 0) + 1;

  transaction.setSelection(TextSelection.near(transaction.doc.resolve(paragraphPosition)));

  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
}

/**
 * Inserts an atom instead of `/command` in the current block.
 *
 * An empty paragraph is replaced by the atom, a non-empty one keeps its text
 * and the atom goes below it. Inside a toggle, list or column the atom escapes
 * to the top level after the container.
 */
export function insertAtomicAtSlash(
  editor: Editor,
  range: SlashRange,
  node: ProseMirrorNode,
): boolean {
  const chain = editor.chain().focus().deleteRange(range);

  if (editor.isActive('taskItem')) {
    chain.liftListItem('taskItem');
  } else if (editor.isActive('listItem')) {
    chain.liftListItem('listItem');
  }

  chain.run();

  const { selection } = editor.state;
  const paragraph = editor.state.schema.nodes['paragraph'];

  if (!paragraph || selection.$from.depth < 1) {
    return false;
  }

  const $from = selection.$from;

  let depth = $from.depth;

  while (depth > 1 && !$from.node(depth).isTextblock) {
    depth -= 1;
  }

  const textblock = $from.node(depth);
  const parent = $from.node(depth - 1);
  const parentTypeName = parent.type.name;
  const escapesToTopLevel =
    parentTypeName === 'details' ||
    parentTypeName === 'listItem' ||
    parentTypeName === 'taskItem' ||
    depth !== $from.depth;

  if (escapesToTopLevel) {
    // Top-level block under the cursor: insert after it as a whole.
    const topLevel = $from.node(1);

    insertNodes(editor, $from.before(1) + topLevel.nodeSize, [node, paragraph.create()]);
  } else if (textblock.type.name === 'paragraph' && textblock.textContent.length === 0) {
    const start = $from.before(depth);
    const transaction = editor.state.tr.replaceWith(start, $from.after(depth), [
      node,
      paragraph.create(),
    ]);
    const cursor = start + node.nodeSize + 1;

    transaction.setSelection(TextSelection.near(transaction.doc.resolve(cursor)));
    editor.view.dispatch(transaction.scrollIntoView());
    editor.commands.focus();
  } else {
    insertNodes(editor, $from.after(depth), [node, paragraph.create()]);
  }

  return true;
}

/** Inserts an atom below the block the plus menu is open over. */
export function insertAtomicBelow(
  editor: Editor,
  source: EditorBlockLocation,
  node: ProseMirrorNode,
): boolean {
  const paragraph = editor.state.schema.nodes['paragraph'];

  if (!paragraph) {
    return false;
  }

  // An atom leaves a list: it lands after the whole list, not inside listItem.
  const position = LIST_WRAPPER_TYPES.has(source.parent.type.name)
    ? source.parentPos + source.parent.nodeSize
    : source.pos + source.node.nodeSize;

  insertNodes(editor, position, [node, paragraph.create()]);

  return true;
}
