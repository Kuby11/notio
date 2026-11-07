import { PageLinkView } from '../../ui/private/structure-views';
import { blockIdAttribute } from './block-id';
import { editableReactNodeView } from './node-view-utils';
import { uiText } from './ui-placeholder';
import { Node, mergeAttributes } from '@tiptap/react';

export const PageLinkBlock = Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      pageId: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-page-id') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['pageId'] === 'string' && attributes['pageId'].length > 0
            ? { 'data-page-id': attributes['pageId'] }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-block-type="linkToPage"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const pageId = typeof node.attrs['pageId'] === 'string' ? node.attrs['pageId'] : '';

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'linkToPage',
        class: 'notio-page-link',
        'data-page-id': pageId,
        role: 'link',
        'aria-label': pageId ? uiText('pageLink') : uiText('pickPage'),
      }),
      ['span', { class: 'notio-page-title' }, pageId ? uiText('page') : uiText('pickPage')],
    ];
  },
  addNodeView() {
    return editableReactNodeView(PageLinkView);
  },
});

/**
 * Inline database: an atom that renders the databases module's view.
 *
 * Only databaseId is stored in attrs: the block does not duplicate the
 * database schema, and a node without an id is not serialised (see
 * nodeToContent) until the editor has created the database row.
 */
