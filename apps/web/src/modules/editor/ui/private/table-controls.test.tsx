// @vitest-environment jsdom
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithIntl } from '../../../../../test/auth-fixture';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TableControls } from './table-controls';
import { editorExtensions } from '../../utils/editor-extensions';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function createTableEditor(): Editor {
  const current = new Editor({ extensions: editorExtensions });

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
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }],
              },
              {
                type: 'tableCell',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }],
              },
              {
                type: 'tableCell',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '2' }] }],
              },
            ],
          },
        ],
      },
    ],
  });

  // Cursor in the first cell (doc0 table1 row2 cell3 → text at position 4).
  current.commands.setTextSelection(4);

  return current;
}

function tableOf(current: Editor): ProseMirrorNode {
  let table: ProseMirrorNode | null = null;

  current.state.doc.forEach((node) => {
    if (table === null && node.type.name === 'table') {
      table = node;
    }
  });

  if (!table) {
    throw new Error('Table not found');
  }

  return table;
}

describe('TableControls', () => {
  it('shows row and column pills on the table', async () => {
    editor = createTableEditor();

    renderWithIntl(<TableControls editor={editor} />);

    expect(await screen.findByRole('button', { name: 'Add row below' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add column right' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete row' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete column' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag row' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag column' })).toBeInTheDocument();
  });

  it('adds a row and a column via the buttons', async () => {
    editor = createTableEditor();

    renderWithIntl(<TableControls editor={editor} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Add row below' }));

    expect(tableOf(editor).childCount).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: 'Add column right' }));

    expect(tableOf(editor).child(0).childCount).toBe(3);
  });

  it('deletes a row and a column via the buttons', async () => {
    editor = createTableEditor();

    renderWithIntl(<TableControls editor={editor} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Delete row' }));

    expect(tableOf(editor).childCount).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Delete column' }));

    expect(tableOf(editor).child(0).childCount).toBe(1);
  });

  it('hides the pills when the cursor is outside the table', async () => {
    editor = new Editor({ extensions: editorExtensions });

    editor.commands.setContent({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Text' }] },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [{ type: 'tableCell', content: [{ type: 'paragraph' }] }],
            },
          ],
        },
      ],
    });

    // The paragraph occupies 0..7, the table 7.., the cell text cursor is 11.
    editor.commands.setTextSelection(11);

    renderWithIntl(<TableControls editor={editor} />);

    expect(await screen.findByRole('button', { name: 'Add row below' })).toBeInTheDocument();

    editor.commands.setTextSelection(1);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Add row below' })).toBeNull();
    });
  });
});
