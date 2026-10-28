import type { Node as ProseMirrorNode, Schema } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { createTable } from '@tiptap/extension-table';
import type { Editor } from '@tiptap/react';
import type { SlashCommand } from './slash';

/** A ProseMirror block that maps to an editor row. */
export interface EditorBlockLocation {
  /** Position before the block node. */
  pos: number;
  node: ProseMirrorNode;
  parent: ProseMirrorNode;
  /** Position before the parent — needed to leave a list. */
  parentPos: number;
  index: number;
}

const LIST_ITEM_TYPES = new Set(['listItem', 'taskItem']);
const LIST_WRAPPER_TYPES = new Set(['bulletList', 'orderedList', 'taskList']);
const NON_TARGET_TYPES = new Set(['detailsSummary', 'detailsContent']);

/**
 * Restores the block at the position the official DragHandle reports.
 * The position points at the start of the node, so `nodeAfter` is enough.
 */
export function findBlockAtPosition(editor: Editor, position: number): EditorBlockLocation | null {
  const { doc } = editor.state;

  if (!Number.isInteger(position) || position < 0 || position > doc.content.size) {
    return null;
  }

  const $position = doc.resolve(position);
  const node = $position.nodeAfter;

  if (!node?.isBlock || NON_TARGET_TYPES.has(node.type.name)) {
    return null;
  }

  return {
    pos: $position.pos,
    node,
    parent: $position.parent,
    parentPos: $position.depth > 0 ? $position.before() : 0,
    index: $position.index(),
  };
}

function sameListKind(command: SlashCommand, listType: string): boolean {
  if (listType === 'bulletList') {
    return command.kind === 'bulletList';
  }

  if (listType === 'orderedList') {
    return command.kind === 'orderedList';
  }

  return command.kind === 'toDo';
}

/** Creates an empty node for the plus menu command. */
function createBlockNode(command: SlashCommand, schema: Schema): ProseMirrorNode | null {
  const paragraph = schema.nodes['paragraph'];
  const heading = schema.nodes['heading'];
  const bulletList = schema.nodes['bulletList'];
  const orderedList = schema.nodes['orderedList'];
  const listItem = schema.nodes['listItem'];
  const taskList = schema.nodes['taskList'];
  const taskItem = schema.nodes['taskItem'];
  const details = schema.nodes['details'];
  const detailsSummary = schema.nodes['detailsSummary'];
  const detailsContent = schema.nodes['detailsContent'];
  const blockquote = schema.nodes['blockquote'];
  const horizontalRule = schema.nodes['horizontalRule'];
  const codeBlock = schema.nodes['codeBlock'];
  const image = schema.nodes['image'];
  const video = schema.nodes['video'];
  const file = schema.nodes['file'];
  const emoji = schema.nodes['emoji'];
  const columnsList = schema.nodes['columnsList'];
  const columnsColumn = schema.nodes['columnsColumn'];
  const equationBlock = schema.nodes['equationBlock'];
  const inlineMath = schema.nodes['inlineMath'];
  const pageLink = schema.nodes['pageLink'];
  const breadcrumbBlock = schema.nodes['breadcrumbBlock'];

  switch (command.kind) {
    case 'paragraph':
      return paragraph?.create() ?? null;
    case 'heading':
      return heading?.create({ level: command.headingLevel ?? 1 }) ?? null;
    case 'bulletList':
      return bulletList && listItem && paragraph
        ? bulletList.create(null, [listItem.create(null, [paragraph.create()])])
        : null;
    case 'orderedList':
      return orderedList && listItem && paragraph
        ? orderedList.create(null, [listItem.create(null, [paragraph.create()])])
        : null;
    case 'toDo':
      return taskList && taskItem && paragraph
        ? taskList.create(null, [taskItem.create({ checked: false }, [paragraph.create()])])
        : null;
    case 'toggle':
      return details && detailsSummary && detailsContent && paragraph
        ? details.create({ open: true }, [
            detailsSummary.create(),
            detailsContent.create(null, [paragraph.create()]),
          ])
        : null;
    case 'quote':
      return blockquote && paragraph ? blockquote.create(null, [paragraph.create()]) : null;
    case 'divider':
      return horizontalRule?.create() ?? null;
    case 'table':
      // The official extension's utility builds a table from the editor's schema.
      return createTable(schema, 3, 3, true);
    case 'code':
      return codeBlock?.create() ?? null;
    case 'image':
      return image?.create() ?? null;
    case 'video':
      return video?.create() ?? null;
    case 'file':
      return file?.create() ?? null;
    case 'emoji':
      return emoji?.create() ?? null;
    case 'columns': {
      const count = command.columnsCount ?? 2;
      const emptyParagraph = schema.nodes['paragraph']?.create();

      if (!columnsList || !columnsColumn || !emptyParagraph) {
        return null;
      }

      const columns = Array.from({ length: count }, () =>
        columnsColumn.create(null, [emptyParagraph]),
      );

      return columns.every((column) => column !== undefined)
        ? (columnsList.create(null, columns) ?? null)
        : null;
    }
    case 'equation':
      return equationBlock?.create({ expression: '' }) ?? null;
    case 'inlineEquation': {
      const expression = inlineMath?.create({ expression: '' });

      return expression && paragraph ? (paragraph.create(null, [expression]) ?? null) : null;
    }
    case 'linkToPage':
      // pageId is empty: the node is not serialised until a page is chosen.
      return pageLink?.create({ pageId: '' }) ?? null;
    case 'breadcrumb':
      return breadcrumbBlock?.create() ?? null;
    case 'page':
      // A sub-page is inserted asynchronously after the page is created.
      return null;
  }
}

function createListItemNode(command: SlashCommand, schema: Schema): ProseMirrorNode | null {
  const paragraph = schema.nodes['paragraph'];

  if (!paragraph) {
    return null;
  }

  if (command.kind === 'toDo') {
    return schema.nodes['taskItem']?.create({ checked: false }, [paragraph.create()]) ?? null;
  }

  if (command.kind === 'bulletList' || command.kind === 'orderedList') {
    return schema.nodes['listItem']?.create(null, [paragraph.create()]) ?? null;
  }

  return null;
}

/** Position of the first text block inside the inserted node. */
export function firstTextblockPosition(node: ProseMirrorNode, nodePosition: number): number | null {
  if (node.isTextblock) {
    return nodePosition + 1;
  }

  let offset = nodePosition + 1;

  for (let index = 0; index < node.childCount; index += 1) {
    const child = node.child(index);
    const found = firstTextblockPosition(child, offset);

    if (found !== null) {
      return found;
    }

    offset += child.nodeSize;
  }

  return null;
}

/**
 * Inserts an empty block right under the given one.
 *
 * Notion's plus does not add the `/`, it creates the row at once. For a list
 * item a block of the same type becomes the new listItem, otherwise the new
 * block lands after the whole list — so it never ends up as an invalid child
 * of listItem.
 */
export function insertBlockBelow(
  editor: Editor,
  source: EditorBlockLocation,
  command: SlashCommand,
): boolean {
  const { schema } = editor.state.doc.type;
  const sourceType = source.node.type.name;
  const isListItem = LIST_ITEM_TYPES.has(sourceType);
  const listType = isListItem ? source.parent.type.name : null;
  const insertIntoList = listType !== null && sameListKind(command, listType);

  let insertPosition = source.pos + source.node.nodeSize;
  const node = insertIntoList
    ? createListItemNode(command, schema)
    : createBlockNode(command, schema);

  if (isListItem && !insertIntoList) {
    insertPosition = source.parentPos + source.parent.nodeSize;
  }

  if (!node) {
    return false;
  }

  const $insert = editor.state.doc.resolve(insertPosition);

  // A list item is valid only inside its own list; the other blocks go
  // wherever the position after the list fell. At the top level that is doc.
  if (!$insert.parent.canReplaceWith($insert.index(), $insert.index(), node.type)) {
    return false;
  }

  const transaction = editor.state.tr.insert(insertPosition, node);
  const textblockPosition = firstTextblockPosition(node, insertPosition);

  if (textblockPosition !== null) {
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(textblockPosition)));
  }

  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();

  return true;
}

/** Whether a block can be inserted after this one (for the plus menu). */
export function canInsertBelow(block: EditorBlockLocation): boolean {
  return block.node.isBlock && !LIST_WRAPPER_TYPES.has(block.node.type.name);
}
