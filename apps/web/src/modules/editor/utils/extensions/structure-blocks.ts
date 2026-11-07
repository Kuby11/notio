import { EquationBlockView, InlineMathView } from '../../ui/private/equation-views';
import { ColumnsColumnView } from '../../ui/private/structure-views';
import { blockIdAttribute } from './block-id';
import { editableReactNodeView } from './node-view-utils';
import { Node, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';

export const ColumnsListBlock = Node.create({
  name: 'columnsList',
  group: 'block',
  content: 'columnsColumn+',
  defining: true,
  isolating: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { blockId: blockIdAttribute };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="columns"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block-type': 'columns', class: 'notio-columns' }),
      0,
    ];
  },
});

/** A column without a React wrapper: used by renderHTML and serialisation. */
export const ColumnsColumnBlock = Node.create({
  name: 'columnsColumn',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-column]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-column': '', class: 'notio-column' }),
      0,
    ];
  },
  // A contentful view without editableReactNodeView: PM manages
  // contenteditable inside contentDOM itself; no atomic wrapper is needed here.
  addNodeView() {
    return ReactNodeViewRenderer(ColumnsColumnView);
  },
});

/**
 * Block formula: an atom with LaTeX in attrs, rendered by a KaTeX node view.
 * An empty expression pasted from the slash menu opens for editing by itself.
 */
export const EquationBlock = Node.create({
  name: 'equationBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      expression: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-expression') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['expression'] === 'string' && attributes['expression'].length > 0
            ? { 'data-expression': attributes['expression'] }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="equation"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block-type': 'equation', class: 'notio-equation' }),
      ['span', {}, typeof node.attrs['expression'] === 'string' ? node.attrs['expression'] : ''],
    ];
  },
  addNodeView() {
    return editableReactNodeView(EquationBlockView);
  },
});

/**
 * Inline formula: an atom inside text. The value lives in attrs.expression
 * and serialises as the contract's {math} segment (see inlineSegmentsFromNode).
 */
export const InlineMath = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      expression: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-expression') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['expression'] === 'string' && attributes['expression'].length > 0
            ? { 'data-expression': attributes['expression'] }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-inline-math]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const expression = typeof node.attrs['expression'] === 'string' ? node.attrs['expression'] : '';

    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-inline-math': '', 'data-expression': expression }),
      expression,
    ];
  },
  addNodeView() {
    return editableReactNodeView(InlineMathView);
  },
});

/**
 * Link to an existing page (not a child one): unlike subPage it stores only
 * pageId — the title is fetched through the bridge, so renaming the page does
 * not break the block. Without pageId the node is not serialised
 * (pageLink in nodeToContent) and is not saved.
 */
