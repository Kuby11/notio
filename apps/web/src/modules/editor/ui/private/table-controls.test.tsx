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
    throw new Error('Таблица не найдена');
  }

  return table;
}

describe('TableControls', () => {
  it('показывает пилюли строки и колонки в таблице', async () => {
    editor = createTableEditor();

    renderWithIntl(<TableControls editor={editor} />);

    expect(await screen.findByRole('button', { name: 'Добавить строку ниже' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить колонку справа' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Удалить строку' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Удалить колонку' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Перетащить строку' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Перетащить колонку' })).toBeInTheDocument();
  });

  it('добавляет строку и колонку по кнопкам', async () => {
    editor = createTableEditor();

    renderWithIntl(<TableControls editor={editor} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Добавить строку ниже' }));

    expect(tableOf(editor).childCount).toBe(3);

    fireEvent.click(screen.getByRole('button', { name: 'Добавить колонку справа' }));

    expect(tableOf(editor).child(0).childCount).toBe(3);
  });

  it('удаляет строку и колонку по кнопкам', async () => {
    editor = createTableEditor();

    renderWithIntl(<TableControls editor={editor} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Удалить строку' }));

    expect(tableOf(editor).childCount).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Удалить колонку' }));

    expect(tableOf(editor).child(0).childCount).toBe(1);
  });

  it('прячет пилюли, когда курсор вне таблицы', async () => {
    editor = new Editor({ extensions: editorExtensions });

    editor.commands.setContent({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Текст' }] },
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

    expect(await screen.findByRole('button', { name: 'Добавить строку ниже' })).toBeInTheDocument();

    editor.commands.setTextSelection(1);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Добавить строку ниже' })).toBeNull();
    });
  });
});
