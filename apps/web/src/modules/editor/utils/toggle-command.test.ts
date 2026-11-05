// @vitest-environment jsdom
import { Editor, type AnyExtension } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { afterEach, describe, expect, it } from 'vitest';
import { editorExtensions } from './editor-extensions';
import { replaceTextblockWithDetails } from './toggle-command';

const EXTENSIONS: AnyExtension[] = editorExtensions.map((extension) =>
  extension.name === 'starterKit' ? extension.configure({ dropcursor: false }) : extension,
);

interface JsonNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  text?: string;
}

let editor: Editor | null = null;

function createEditor(content: unknown, extensions: AnyExtension[] = EXTENSIONS): Editor {
  editor = new Editor({ extensions, content: content as never });

  return editor;
}

function doc(current: Editor): JsonNode {
  return current.getJSON() as unknown as JsonNode;
}

function apply(current: Editor, position?: number): boolean {
  const transaction = current.state.tr;
  const changed = replaceTextblockWithDetails(transaction, position);

  if (changed) {
    current.view.dispatch(transaction);
  }

  return changed;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('replaceTextblockWithDetails', () => {
  it('turns a paragraph into a toggle with an editable heading', () => {
    const current = createEditor('<p>Heading text</p>');

    expect(apply(current, 1)).toBe(true);

    const details = doc(current).content?.[0];
    expect(details?.type).toBe('details');
    expect(details?.attrs?.['open']).toBe(true);
    expect(details?.content?.[0]?.type).toBe('detailsSummary');
    expect(details?.content?.[0]?.content?.[0]?.text).toBe('Heading text');
    expect(details?.content?.[1]?.type).toBe('detailsContent');
    expect(details?.content?.[1]?.content?.[0]?.type).toBe('paragraph');

    // Cursor at the end of the heading.
    expect(current.state.selection.$from.parent.type.name).toBe('detailsSummary');
  });

  it('uses the current selection when no position is given', () => {
    const current = createEditor('<p>Selected</p>');
    current.commands.setTextSelection(3);

    expect(apply(current)).toBe(true);
    expect(doc(current).content?.[0]?.type).toBe('details');
  });

  it('keeps the block id on the toggle', () => {
    const current = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { blockId: 'block-1' },
          content: [{ type: 'text', text: 'Kept' }],
        },
      ],
    });

    expect(apply(current, 1)).toBe(true);
    expect(doc(current).content?.[0]?.attrs?.['blockId']).toBe('block-1');
  });

  it('creates an empty summary for an empty paragraph', () => {
    const current = createEditor('<p></p>');

    expect(apply(current, 1)).toBe(true);
    expect(doc(current).content?.[0]?.content?.[0]?.content ?? []).toEqual([]);
  });

  it('converts text inside a toggle body', () => {
    const current = createEditor({
      type: 'doc',
      content: [
        {
          type: 'details',
          attrs: { open: true },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Outer' }] },
            {
              type: 'detailsContent',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inner' }] }],
            },
          ],
        },
      ],
    });

    // Position of the inner paragraph.
    let inner = -1;
    current.state.doc.descendants((node, position) => {
      if (inner === -1 && node.isTextblock && node.textContent === 'Inner') {
        inner = position + 1;
        return false;
      }

      return true;
    });
    expect(inner).toBeGreaterThan(0);

    expect(apply(current, inner)).toBe(true);

    const innerDetails = doc(current).content?.[0]?.content?.[1]?.content?.[0];
    expect(innerDetails?.type).toBe('details');
  });

  it('refuses a position in the document itself', () => {
    const current = createEditor('<p>Text</p>');

    expect(apply(current, 0)).toBe(false);
  });

  it('refuses when the schema has no details nodes', () => {
    const current = createEditor('<p>Text</p>', [StarterKit]);

    expect(apply(current, 1)).toBe(false);
  });
});
