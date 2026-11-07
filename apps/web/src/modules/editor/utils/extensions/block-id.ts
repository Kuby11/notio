import { newId } from '@notio/contracts';
import { Plugin } from '@tiptap/pm/state';
import { Extension } from '@tiptap/react';

export const blockIdAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute('data-block-id'),
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes['blockId'] ? { 'data-block-id': attributes['blockId'] } : {},
};

/** Factory of the colour preset data attribute (data-color / data-background-color). */
export function colorDataAttribute(name: 'color' | 'backgroundColor') {
  const dataName = name === 'color' ? 'data-color' : 'data-background-color';

  return {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute(dataName),
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes[name] ? { [dataName]: attributes[name] } : {},
  };
}

/** Text and background colours live in block content (see ADR 0017). */
const COLORABLE_NODE_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'listItem',
  'taskItem',
  'details',
  'table',
] as const;

/**
 * Block id on standard Tiptap nodes (paragraph, heading, listItem and so on).
 * Without it, after hydration it is impossible to tell which database row to update.
 */
export const BlockIdAttribute = Extension.create({
  name: 'blockIdAttribute',
  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'blockquote',
          'codeBlock',
          'horizontalRule',
          'listItem',
          'taskItem',
          'details',
          'table',
        ],
        attributes: {
          blockId: blockIdAttribute,
        },
      },
      {
        types: [...COLORABLE_NODE_TYPES],
        attributes: {
          color: colorDataAttribute('color'),
          backgroundColor: colorDataAttribute('backgroundColor'),
        },
      },
    ];
  },
});

/**
 * Nodes that map to a separate `blocks` row.
 *
 * Blocks nested in a toggle live inside its content, so only top-level nodes
 * and list items receive ids. A table is one row: its rows and cells
 * serialise into its content.
 */
const BLOCK_ROW_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'image',
  'video',
  'file',
  'emoji',
  'details',
  'table',
  'subPage',
  'columnsList',
  'equationBlock',
  'pageLink',
  'breadcrumbBlock',
  'databaseBlock',
  'databaseLink',
]);

export function ownsBlockRow(typeName: string, parentTypeName: string | null): boolean {
  if (typeName === 'listItem' || typeName === 'taskItem') {
    return true;
  }

  return parentTypeName === 'doc' && BLOCK_ROW_TYPES.has(typeName);
}

/**
 * Hands out ids to new blocks before autosave.
 *
 * Autosave compares editor nodes with database blocks by blockId. Enter/insert
 * create nodes without ids, and splitting a block copies attrs — the second
 * node would get someone else's id. The plugin assigns missing and duplicate
 * ids in a single transaction, so the diff is always unambiguous.
 */
export const BlockIdGuard = Extension.create({
  name: 'blockIdGuard',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          const seen = new Set<string>();
          const transaction = newState.tr;
          let assigned = false;

          newState.doc.descendants((node, position, parent) => {
            if (!ownsBlockRow(node.type.name, parent?.type.name ?? null)) {
              return;
            }

            const blockId = node.attrs['blockId'];
            const hasUniqueId =
              typeof blockId === 'string' && blockId.length > 0 && !seen.has(blockId);

            if (hasUniqueId) {
              seen.add(blockId);
              return;
            }

            const nextBlockId = newId();
            seen.add(nextBlockId);
            transaction.setNodeMarkup(position, undefined, {
              ...node.attrs,
              blockId: nextBlockId,
            });
            assigned = true;
          });

          if (!assigned) {
            return null;
          }

          // Ids are service markup, not an undo history step.
          transaction.setMeta('addToHistory', false);

          return transaction;
        },
      }),
    ];
  },
});
