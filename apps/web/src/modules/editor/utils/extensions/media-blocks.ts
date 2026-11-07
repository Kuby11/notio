import { EmojiView, FileView, ImageView, VideoView } from '../../ui/private/media-views';
import { blockIdAttribute } from './block-id';
import { editableReactNodeView } from './node-view-utils';
import { uiText } from './ui-placeholder';
import type { DOMOutputSpec, Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Node, mergeAttributes } from '@tiptap/react';

export function mediaDataAttribute(dataName: string) {
  return {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute(dataName),
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = attributes[dataName];

      return value === null || value === undefined || value === ''
        ? {}
        : { [dataName]: String(value) };
    },
  };
}

/**
 * Image: a file in R2 (fileId) or an external link (url).
 * Upload and rendering are handled by the React node view
 * (ui/private/media-views); renderHTML stays as the fallback for contexts
 * without a node view.
 */
export const ImageBlock = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      fileId: mediaDataAttribute('data-file-id'),
      url: mediaDataAttribute('data-url'),
      caption: mediaDataAttribute('data-caption'),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-width');

          return value === null ? null : Number.parseInt(value, 10);
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['width'] === 'number'
            ? { 'data-width': String(attributes['width']) }
            : {},
      },
      fullWidth: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-full-width') === 'true',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['fullWidth'] === true ? { 'data-full-width': 'true' } : {},
      },
      // Service flag "source replacement in progress": not serialised, switches on
      // the upload card over an existing block (the "Replace" action).
      replacing: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-block-type="image"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return mediaFigureHTML('image', node, HTMLAttributes, uiText('image'));
  },
  addNodeView() {
    return editableReactNodeView(ImageView);
  },
});

/** Video: like image, but with a player and a 50 MB limit. */
export const VideoBlock = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      fileId: mediaDataAttribute('data-file-id'),
      url: mediaDataAttribute('data-url'),
      caption: mediaDataAttribute('data-caption'),
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-block-type="video"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return mediaFigureHTML('video', node, HTMLAttributes, uiText('video'));
  },
  addNodeView() {
    return editableReactNodeView(VideoView);
  },
});

/** File: a row with name, size and download. */
export const FileBlock = Node.create({
  name: 'file',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      fileId: mediaDataAttribute('data-file-id'),
      url: mediaDataAttribute('data-url'),
      name: {
        default: 'File',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-name') ?? uiText('file'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['name'] ? { 'data-name': String(attributes['name']) } : {},
      },
      sizeBytes: mediaDataAttribute('data-size-bytes'),
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="file"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const name = typeof node.attrs['name'] === 'string' ? node.attrs['name'] : uiText('file');

    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block-type': 'file', class: 'notio-file' }),
      ['span', { 'aria-hidden': 'true' }, '📎'],
      ['span', { class: 'notio-file-name' }, name],
    ];
  },
  addNodeView() {
    return editableReactNodeView(FileView);
  },
});

/** Emoji block: one large character, changed through a picker. */
export const EmojiBlock = Node.create({
  name: 'emoji',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      emoji: {
        default: '⭐',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-emoji') ?? '⭐',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['emoji'] ? { 'data-emoji': String(attributes['emoji']) } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="emoji"]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const emoji = typeof node.attrs['emoji'] === 'string' ? node.attrs['emoji'] : '⭐';

    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block-type': 'emoji', class: 'notio-emoji' }),
      ['span', { class: 'notio-emoji-value' }, emoji],
    ];
  },
  addNodeView() {
    return editableReactNodeView(EmojiView);
  },
});

/** Fallback markup for a media node without a node view (hydration, copying). */
export function mediaFigureHTML(
  blockType: string,
  node: ProseMirrorNode,
  HTMLAttributes: Record<string, unknown>,
  label: string,
): DOMOutputSpec {
  const fileId = typeof node.attrs['fileId'] === 'string' ? node.attrs['fileId'] : '';
  const url = typeof node.attrs['url'] === 'string' ? node.attrs['url'] : '';
  const src = url || (fileId ? `/api/media/files/${fileId}` : '');
  const caption = typeof node.attrs['caption'] === 'string' ? node.attrs['caption'] : '';
  const width = typeof node.attrs['width'] === 'number' ? node.attrs['width'] : null;
  const fullWidth = node.attrs['fullWidth'] === true;

  return [
    'figure',
    mergeAttributes(HTMLAttributes, {
      'data-block-type': blockType,
      'data-full-width': fullWidth ? 'true' : 'false',
      ...(width !== null && !fullWidth ? { style: `width: ${width}%` } : {}),
    }),
    src ? ['img', { src, alt: caption || label }] : ['span', {}, label],
    ['figcaption', {}, caption],
  ];
}

/**
 * Link to a child page — an atomic node, like a Notion sub-page.
 *
 * The pageId attribute stays empty while the service creates the page: such a
 * node is not serialised into BlockContent (see pageContentFromNode) and is
 * not saved, and after the service responds attrs update to the real page data.
 */
