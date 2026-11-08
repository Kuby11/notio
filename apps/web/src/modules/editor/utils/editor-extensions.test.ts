// @vitest-environment jsdom
import { Editor, type AnyExtension } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { editorExtensions } from './editor-extensions';
import { applySlashCommand } from './slash-command';
import { SLASH_COMMANDS, type SlashCommand } from './slash';

/** The first top-level node of the given type. */
function findNodeOfType(current: Editor, typeName: string): ProseMirrorNode | null {
  let found: ProseMirrorNode | null = null;

  current.state.doc.forEach((node) => {
    if (found === null && node.type.name === typeName) {
      found = node;
    }
  });

  return found;
}

let editor: Editor | null = null;

function createEditor(extensions: AnyExtension[] = editorExtensions): Editor {
  editor = new Editor({ extensions });

  return editor;
}

/**
 * StarterKit without a drop cursor: its own dragover fails in jsdom on the
 * layout API (`getClientRects`), which jsdom does not implement.
 */
const DRAG_EXTENSIONS: AnyExtension[] = editorExtensions.map((extension) =>
  extension.name === 'starterKit' ? extension.configure({ dropcursor: false }) : extension,
);

function blockIds(current: Editor): (string | null)[] {
  return (current.getJSON().content ?? []).map((node) => {
    const blockId = node.attrs?.['blockId'];

    return typeof blockId === 'string' ? blockId : null;
  });
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** Absolute position of the text node: the drop target is computed from it. */
function textPosition(current: Editor, text: string): number {
  let found = -1;

  current.state.doc.descendants((node, position) => {
    if (found !== -1) {
      return false;
    }

    if (node.isText && node.text === text) {
      found = position;
      return false;
    }

    return true;
  });

  if (found === -1) {
    throw new Error(`Text "${text}" not found in the document`);
  }

  return found;
}

/**
 * A toggle block with a child paragraph and a neighbouring top-level block.
 * Dropping on "Inside" aligns inside the toggle, on "Outside" it does not.
 */
function documentWithToggle(): Editor {
  const current = createEditor(DRAG_EXTENSIONS);

  current.commands.setContent({
    type: 'doc',
    content: [
      {
        type: 'details',
        attrs: { open: true },
        content: [
          { type: 'detailsSummary', content: [{ type: 'text', text: 'Heading' }] },
          {
            type: 'detailsContent',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inside' }] }],
          },
        ],
      },
      { type: 'paragraph', content: [{ type: 'text', text: 'Outside' }] },
    ],
  });

  return current;
}

function dragOver(current: Editor): void {
  current.view.dom.dispatchEvent(new MouseEvent('dragover', { bubbles: true }));
}

describe('DropTargetHighlight', () => {
  it('highlights the toggle when the drop is aligned inside it', () => {
    const current = documentWithToggle();
    const posAtCoords = vi.spyOn(current.view, 'posAtCoords');

    posAtCoords.mockReturnValue({ pos: textPosition(current, 'Inside'), inside: -1 });
    dragOver(current);

    expect(current.view.dom.querySelector('[data-type="details"]')).toHaveClass(
      'notio-drop-target',
    );
  });

  it('removes the highlight when the drop moves to a block without children', () => {
    const current = documentWithToggle();
    const posAtCoords = vi.spyOn(current.view, 'posAtCoords');

    posAtCoords.mockReturnValue({ pos: textPosition(current, 'Inside'), inside: -1 });
    dragOver(current);

    const details = current.view.dom.querySelector('[data-type="details"]');
    expect(details).toHaveClass('notio-drop-target');

    posAtCoords.mockReturnValue({ pos: textPosition(current, 'Outside'), inside: -1 });
    dragOver(current);

    expect(details).not.toHaveClass('notio-drop-target');
  });

  it('removes the highlight after the drag ends', () => {
    const current = documentWithToggle();
    const posAtCoords = vi.spyOn(current.view, 'posAtCoords');

    posAtCoords.mockReturnValue({ pos: textPosition(current, 'Inside'), inside: -1 });
    dragOver(current);

    const details = current.view.dom.querySelector('[data-type="details"]');
    expect(details).toHaveClass('notio-drop-target');

    document.dispatchEvent(new Event('dragend'));

    expect(details).not.toHaveClass('notio-drop-target');
  });
});

describe('BlockIdGuard', () => {
  it('assigns ids to blocks that arrive without one', () => {
    const current = createEditor();

    current.commands.setContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    });

    const [blockId] = blockIds(current);

    expect(blockId).not.toBeNull();
  });

  it('gives different ids to the two halves of a split block', () => {
    const current = createEditor();

    current.commands.setContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    });

    current.commands.setTextSelection(4);
    current.commands.splitBlock();

    const ids = blockIds(current);

    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBeNull();
    expect(ids[1]).not.toBeNull();
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('moves the placeholder to the block with the cursor', () => {
    const current = createEditor();

    current.commands.setContent({
      type: 'doc',
      content: [{ type: 'paragraph' }, { type: 'paragraph' }],
    });

    current.commands.setTextSelection(1);

    const beforeEach = current.view.dom.querySelectorAll('[data-placeholder]');
    expect(beforeEach).toHaveLength(1);

    current.commands.setTextSelection(3);

    const after = current.view.dom.querySelectorAll('[data-placeholder]');

    expect(after).toHaveLength(1);
    expect(after[0]).toBe(current.view.nodeDOM(2));
  });

  it('moves the placeholder between empty list items', () => {
    const current = createEditor();

    current.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph' }] },
            { type: 'listItem', content: [{ type: 'paragraph' }] },
          ],
        },
      ],
    });

    current.commands.setTextSelection(3);
    expect(current.view.dom.querySelectorAll('[data-placeholder]')).toHaveLength(1);
    expect(current.view.dom.querySelector('[data-placeholder]')).toBe(current.view.nodeDOM(2));

    current.commands.setTextSelection(7);

    const after = current.view.dom.querySelectorAll('[data-placeholder]');

    expect(after).toHaveLength(1);
    expect(after[0]).toBe(current.view.nodeDOM(6));
  });

  it('keeps the id across a plain text change', () => {
    const current = createEditor();

    current.commands.setContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    });

    const [blockId] = blockIds(current);

    // Position 6 is the end of the 'Hello' paragraph: an insert inside the block.
    current.commands.insertContentAt(6, '!');

    expect(blockIds(current)).toEqual([blockId]);
  });
});

function commandOf(id: string): SlashCommand {
  const command = SLASH_COMMANDS.find((entry) => entry.id === id);

  if (!command) {
    throw new Error(`Command ${id} not found`);
  }

  return command;
}

function editorWithParagraph(text = 'Text'): Editor {
  const current = createEditor();

  current.commands.setContent({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  current.commands.setTextSelection(2);

  return current;
}

describe('Slash commands for new blocks', () => {
  it('turns a line into a quote', () => {
    const current = editorWithParagraph();

    applySlashCommand(current, commandOf('quote'), { from: 1, to: 2 });

    expect(current.getJSON().content?.[0]?.type).toBe('blockquote');
  });

  it('inserts a divider after a line', () => {
    const current = editorWithParagraph();

    // Cursor at the end of the line: the divider is inserted after the paragraph.
    // The official command leaves an empty paragraph behind it for typing.
    current.commands.setTextSelection(6);
    applySlashCommand(current, commandOf('divider'), { from: 6, to: 6 });

    expect(current.getJSON().content?.map((node) => node.type)).toEqual([
      'paragraph',
      'horizontalRule',
      'paragraph',
    ]);
    expect(current.state.doc.lastChild?.textContent).toBe('');
  });

  it('inserts a 3x3 table with a header row', () => {
    const current = editorWithParagraph();

    applySlashCommand(current, commandOf('table'), { from: 1, to: 2 });

    const table = findNodeOfType(current, 'table');

    expect(table).not.toBeNull();
    expect(table?.childCount).toBe(3);

    const cellTypes = (rowIndex: number): string[] => {
      const cells: string[] = [];

      table?.child(rowIndex).forEach((cell) => {
        cells.push(cell.type.name);
      });

      return cells;
    };

    expect(cellTypes(0)).toEqual(['tableHeader', 'tableHeader', 'tableHeader']);
    expect(cellTypes(1)).toEqual(['tableCell', 'tableCell', 'tableCell']);
    expect(cellTypes(2)).toEqual(['tableCell', 'tableCell', 'tableCell']);
  });

  it('leaves the list before turning into a quote', () => {
    const current = createEditor();

    current.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }],
            },
          ],
        },
      ],
    });
    current.commands.setTextSelection(3);

    applySlashCommand(current, commandOf('quote'), { from: 2, to: 3 });

    const document = current.getJSON();

    expect(document.content?.[0]?.type).toBe('blockquote');
    expect(current.state.doc.firstChild?.childCount).toBe(1);
  });
});

describe('SubPageBlock', () => {
  it('renders a page link and receives the block id from the guard', () => {
    const current = createEditor();
    const pageId = '00000000-0000-4000-8000-000000000013';

    current.commands.setContent({
      type: 'doc',
      content: [{ type: 'subPage', attrs: { pageId, title: 'Child', icon: '📄' } }],
    });

    const link = current.view.dom.querySelector('a[data-block-type="page"]');

    expect(link).not.toBeNull();
    expect(link?.getAttribute('data-page-id')).toBe(pageId);
    expect(link?.textContent).toContain('Child');
    expect(blockIds(current)[0]).not.toBeNull();
  });

  it('shows the creating stub while there is no pageId', () => {
    const current = createEditor();

    current.commands.setContent({
      type: 'doc',
      content: [{ type: 'subPage', attrs: { pageId: null, title: '', icon: null } }],
    });

    const link = current.view.dom.querySelector('a[data-block-type="page"]');

    expect(link?.getAttribute('data-page-id')).toBeNull();
    expect(link?.textContent).toContain('Creating page…');
  });
});

describe('Table', () => {
  it('outlines the cell with the cursor', () => {
    const current = createEditor();

    current.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell' }] }],
                },
              ],
            },
          ],
        },
      ],
    });

    current.commands.setTextSelection(5);

    const active = current.view.dom.querySelector('td.notio-active-cell, th.notio-active-cell');

    expect(active?.textContent).toBe('Cell');
  });

  it('keeps colwidth and rowHeight in cell and row attrs', () => {
    const current = createEditor();

    current.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              attrs: { rowHeight: 60 },
              content: [
                { type: 'tableCell', attrs: { colwidth: [200] }, content: [{ type: 'paragraph' }] },
                { type: 'tableCell', content: [{ type: 'paragraph' }] },
              ],
            },
          ],
        },
      ],
    });

    const table = findNodeOfType(current, 'table');

    expect(table?.child(0).attrs['rowHeight']).toBe(60);
    expect(table?.child(0).child(0).attrs['colwidth']).toEqual([200]);
    expect(table?.child(0).child(1).attrs['colwidth']).toBeNull();
  });
});
