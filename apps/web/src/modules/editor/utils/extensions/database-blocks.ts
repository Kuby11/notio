import { DatabaseBlockView, DatabaseLinkView } from '../../ui/private/database-view';
import { blockIdAttribute } from './block-id';
import { editableReactNodeView } from './node-view-utils';
import { uiText } from './ui-placeholder';
import { Node, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';

export const DatabaseBlock = Node.create({
  name: 'databaseBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      databaseId: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-database-id') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['databaseId'] === 'string' && attributes['databaseId'].length > 0
            ? { 'data-database-id': attributes['databaseId'] }
            : {},
      },
      viewId: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-view-id') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['viewId'] === 'string' && attributes['viewId'].length > 0
            ? { 'data-view-id': attributes['viewId'] }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="database"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const databaseId = typeof node.attrs['databaseId'] === 'string' ? node.attrs['databaseId'] : '';
    const viewId = typeof node.attrs['viewId'] === 'string' ? node.attrs['viewId'] : '';

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'database',
        class: 'notio-database',
        ...(viewId.length > 0 ? { 'data-view-id': viewId } : {}),
      }),
      ['span', { class: 'notio-database-label' }, databaseId ? uiText('database') : ''],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(DatabaseBlockView);
  },
});

/**
 * Link to a whole-page database: a chip in the page, the database itself
 * lives on its own route. Only databaseId is stored; the title is fetched
 * through the database bridge, so renaming the database does not break it.
 */
export const DatabaseLinkBlock = Node.create({
  name: 'databaseLink',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      databaseId: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-database-id') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['databaseId'] === 'string' && attributes['databaseId'].length > 0
            ? { 'data-database-id': attributes['databaseId'] }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-block-type="databaseLink"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'databaseLink',
        class: 'notio-page-link',
        role: 'link',
        'aria-label': uiText('database'),
      }),
      ['span', { class: 'notio-page-title' }, uiText('database')],
    ];
  },
  addNodeView() {
    return editableReactNodeView(DatabaseLinkView);
  },
});

/**
 * Breadcrumbs of the current page: an atom without content, the path is
 * computed by the node view through the pages bridge.
 */
