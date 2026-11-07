import { Mark, mergeAttributes } from '@tiptap/react';

function colorMark(name: 'textColor' | 'textBg', dataName: string) {
  return Mark.create({
    name,
    inclusive: false,
    addAttributes() {
      return {
        color: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute(dataName),
          renderHTML: (attributes: Record<string, unknown>) =>
            attributes['color'] ? { [dataName]: String(attributes['color']) } : {},
        },
      };
    },
    parseHTML() {
      return [{ tag: `span[${dataName}]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return ['span', mergeAttributes(HTMLAttributes), 0];
    },
  });
}

export const TextColorMark = colorMark('textColor', 'data-text-color');
export const TextBackgroundMark = colorMark('textBg', 'data-text-bg');

/** Media node data attribute: fileId, url, caption, name, sizeBytes, emoji. */
