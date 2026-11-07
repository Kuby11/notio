import { BreadcrumbView } from '../../ui/private/structure-views';
import { blockIdAttribute } from './block-id';
import { editableReactNodeView } from './node-view-utils';
import { uiText } from './ui-placeholder';
import { Node, mergeAttributes } from '@tiptap/react';

export const BreadcrumbBlock = Node.create({
  name: 'breadcrumbBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { blockId: blockIdAttribute };
  },
  parseHTML() {
    return [{ tag: 'nav[data-block-type="breadcrumb"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'nav',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'breadcrumb',
        class: 'notio-breadcrumb',
        'aria-label': uiText('breadcrumb'),
      }),
      ['span', { class: 'notio-breadcrumb-muted' }, '…'],
    ];
  },
  addNodeView() {
    return editableReactNodeView(BreadcrumbView);
  },
});

/**
 * A table row with a persisted height: dragging its bottom border writes
 * rowHeight into attrs (see RowResize), serialisation goes into the table's
 * content.rowHeights.
 */
