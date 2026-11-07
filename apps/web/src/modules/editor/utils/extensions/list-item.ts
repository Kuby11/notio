import { ListItem } from '@tiptap/extension-list';
import { mergeAttributes } from '@tiptap/react';

export const ListItemBlock = ListItem.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(HTMLAttributes, { class: 'notio-list-item' }),
      [
        'span',
        {
          'data-list-marker': '',
          'aria-hidden': 'true',
          contenteditable: 'false',
          class: 'notio-list-marker',
        },
        '',
      ],
      ['div', { class: 'notio-list-content' }, 0],
    ];
  },
});

/**
 * React node view with an editable wrapper.
 *
 * PM sets contenteditable=false on contentless atomic node views, which makes
 * the browser's caret logic skip the area entirely and always return a position
 * AFTER the block: DragHandle cannot find an atomic media block (and with a
 * neighbour would aim at it instead). An attribute set before PM's check (it
 * respects an existing one) keeps the caret inside the wrapper — the left half
 * of the block gives "before", the right half "after".
 */
