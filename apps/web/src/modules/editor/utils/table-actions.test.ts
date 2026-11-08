// @vitest-environment jsdom
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { moveTableColumn, moveTableRow } from './table-actions';
import { editorExtensions } from './editor-extensions';

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
      { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }],
              },
              {
                type: 'tableHeader',
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
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '3' }] }],
              },
              {
                type: 'tableCell',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: '4' }] }],
              },
            ],
          },
        ],
      },
    ],
  });

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

function tablePosOf(current: Editor): number {
  let position = -1;

  current.state.doc.forEach((node, pos) => {
    if (position === -1 && node.type.name === 'table') {
      position = pos;
    }
  });

  if (position === -1) {
    throw new Error('Table not found');
  }

  return position;
}

function cellTexts(current: Editor): string[][] {
  const rows: string[][] = [];

  tableOf(current).forEach((row) => {
    const cells: string[] = [];

    row.forEach((cell) => {
      cells.push(cell.textContent);
    });

    rows.push(cells);
  });

  return rows;
}

describe('moveTableRow', () => {
  it('moves a row keeping its content', () => {
    editor = createTableEditor();

    const moved = moveTableRow(editor, tablePosOf(editor), 2, 0);

    expect(moved).toBe(true);
    expect(cellTexts(editor)).toEqual([
      ['3', '4'],
      ['A', 'B'],
      ['1', '2'],
    ]);
  });

  it('does nothing when inserting at its own place', () => {
    editor = createTableEditor();

    expect(moveTableRow(editor, tablePosOf(editor), 1, 1)).toBe(false);
    expect(moveTableRow(editor, tablePosOf(editor), 1, 2)).toBe(false);
    expect(cellTexts(editor)[0]).toEqual(['A', 'B']);
  });

  it('keeps row attrs when moving', () => {
    editor = createTableEditor();
    const tablePos = tablePosOf(editor);
    const table = tableOf(editor);
    const secondRowPos = tablePos + 1 + table.child(0).nodeSize;

    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(secondRowPos, undefined, {
        ...table.child(1).attrs,
        rowHeight: 120,
      }),
    );

    moveTableRow(editor, tablePos, 1, 0);

    expect(cellTexts(editor)[0]).toEqual(['1', '2']);
    expect(tableOf(editor).child(0).attrs['rowHeight']).toBe(120);
  });
});

describe('moveTableColumn', () => {
  it('moves a column in every row', () => {
    editor = createTableEditor();

    const moved = moveTableColumn(editor, tablePosOf(editor), 0, 2);

    expect(moved).toBe(true);
    expect(cellTexts(editor)).toEqual([
      ['B', 'A'],
      ['2', '1'],
      ['4', '3'],
    ]);
  });

  it('does nothing when inserting at its own place', () => {
    editor = createTableEditor();

    expect(moveTableColumn(editor, tablePosOf(editor), 0, 0)).toBe(false);
    expect(moveTableColumn(editor, tablePosOf(editor), 0, 1)).toBe(false);
    expect(cellTexts(editor)[0]).toEqual(['A', 'B']);
  });
});
