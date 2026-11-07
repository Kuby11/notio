import { subPageBridge } from '../sub-page';
import { blockIdAttribute } from './block-id';
import { uiText } from './ui-placeholder';
import { NodeSelection } from '@tiptap/pm/state';
import { Node, mergeAttributes } from '@tiptap/react';

export const SubPageBlock = Node.create({
  name: 'subPage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      pageId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-page-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['pageId'] ? { 'data-page-id': attributes['pageId'] } : {},
      },
      title: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-title') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['title'] ? { 'data-title': attributes['title'] } : {},
      },
      icon: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-icon'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['icon'] ? { 'data-icon': attributes['icon'] } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-block-type="page"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const pageId = typeof node.attrs['pageId'] === 'string' ? node.attrs['pageId'] : '';
    const title = typeof node.attrs['title'] === 'string' ? node.attrs['title'] : '';
    const icon =
      typeof node.attrs['icon'] === 'string' && node.attrs['icon'].length > 0
        ? node.attrs['icon']
        : '📄';
    // Locale from <html lang>: renderHTML lives outside the React context.
    const label = title || uiText(pageId ? 'untitled' : 'creatingPage');

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'page',
        class: 'notio-page-link',
        role: 'link',
        'aria-label': label,
      }),
      ['span', { class: 'notio-page-icon', 'aria-hidden': 'true' }, icon],
      ['span', { class: 'notio-page-title' }, label],
    ];
  },
  addKeyboardShortcuts() {
    return {
      // The selected node opens with Enter — like following a link.
      Enter: () => {
        const { selection } = this.editor.state;

        if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'subPage') {
          return false;
        }

        const pageId = selection.node.attrs['pageId'];

        if (typeof pageId === 'string' && pageId.length > 0) {
          subPageBridge(this.editor).openSubPage(pageId);
          return true;
        }

        return false;
      },
    };
  },
});

/**
 * Columns (as in Notion): 2–5 columns in one row block. Column children are
 * ordinary blocks: ownsBlockRow looks at parent=doc, so nested paragraphs get
 * no ids of their own and are saved inside the columns row
 * (see columnsContentFromNode).
 */
