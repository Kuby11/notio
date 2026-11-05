// @vitest-environment jsdom
import { Editor, type AnyExtension } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  canInsertBelow,
  findBlockAtPosition,
  firstTextblockPosition,
  insertBlockBelow,
} from './block-insert';
import { editorExtensions } from './editor-extensions';
import type { SlashCommand, SlashCommandKind } from './slash';

/**
 * StarterKit without a drop cursor: its dragover relies on layout APIs that
 * jsdom does not implement.
 */
const EXTENSIONS: AnyExtension[] = editorExtensions.map((extension) =>
  extension.name === 'starterKit' ? extension.configure({ dropcursor: false }) : extension,
);

let editor: Editor | null = null;

function createEditor(content: unknown = '<p>Hello</p>'): Editor {
  editor = new Editor({ extensions: EXTENSIONS, content: content as never });

  return editor;
}

function command(kind: SlashCommandKind, extra: Partial<SlashCommand> = {}): SlashCommand {
  return {
    id: kind,
    label: kind,
    icon: '',
    markdown: null,
    kind,
    blockType: 'paragraph',
    keywords: [],
    ...extra,
  };
}

function topLevel(current: Editor): { type: string; attrs: Record<string, unknown> }[] {
  return (current.getJSON().content ?? []).map((node) => ({
    type: node.type,
    attrs: (node.attrs ?? {}) as Record<string, unknown>,
  }));
}

function insertAfterFirstParagraph(current: Editor, cmd: SlashCommand): boolean {
  const source = findBlockAtPosition(current, 0);

  expect(source).not.toBeNull();

  return insertBlockBelow(current, source!, cmd);
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('findBlockAtPosition', () => {
  it('returns the block and its surroundings', () => {
    const current = createEditor('<p>Hello</p>');
    const found = findBlockAtPosition(current, 0);

    expect(found).not.toBeNull();
    expect(found?.pos).toBe(0);
    expect(found?.node.type.name).toBe('paragraph');
    expect(found?.parent.type.name).toBe('doc');
    expect(found?.parentPos).toBe(0);
    expect(found?.index).toBe(0);
  });

  it('rejects out-of-range and non-integer positions', () => {
    const current = createEditor('<p>Hello</p>');

    expect(findBlockAtPosition(current, -1)).toBeNull();
    expect(findBlockAtPosition(current, 0.5)).toBeNull();
    expect(findBlockAtPosition(current, current.state.doc.content.size + 1)).toBeNull();
  });

  it('ignores positions that do not start a block', () => {
    const current = createEditor('<p>Hello</p>');

    // Position 2 points inside the text node: no node starts there.
    expect(findBlockAtPosition(current, 2)).toBeNull();
  });

  it('ignores toggle internals that are not draggable blocks', () => {
    const current = createEditor({
      type: 'doc',
      content: [
        {
          type: 'details',
          attrs: { open: true },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Head' }] },
            {
              type: 'detailsContent',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }],
            },
          ],
        },
      ],
    });

    expect(findBlockAtPosition(current, 1)).toBeNull();
  });
});

describe('canInsertBelow', () => {
  it('allows blocks but not list wrappers', () => {
    const current = createEditor('<p>Hello</p>');
    expect(canInsertBelow(findBlockAtPosition(current, 0)!)).toBe(true);

    current.commands.setContent('<ul><li><p>One</p></li></ul>');
    const list = findBlockAtPosition(current, 0);
    expect(list?.node.type.name).toBe('bulletList');
    expect(canInsertBelow(list!)).toBe(false);
  });
});

describe('firstTextblockPosition', () => {
  it('points inside a textblock and finds nested ones', () => {
    const current = createEditor('<p>Hello</p>');
    const paragraph = current.state.doc.child(0);

    expect(firstTextblockPosition(paragraph, 10)).toBe(11);

    const toggles = createEditor({
      type: 'doc',
      content: [
        {
          type: 'details',
          attrs: { open: true },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Head' }] },
            { type: 'detailsContent', content: [{ type: 'paragraph' }] },
          ],
        },
      ],
    });
    const details = toggles.state.doc.child(0);
    expect(firstTextblockPosition(details, 0)).toBeGreaterThan(0);
  });

  it('returns null for a node without textblocks', () => {
    const current = createEditor('<hr>');
    const divider = current.state.doc.child(0);

    expect(divider.type.name).toBe('horizontalRule');
    expect(firstTextblockPosition(divider, 0)).toBeNull();
  });
});

describe('insertBlockBelow: basic blocks', () => {
  it('inserts a paragraph and moves the cursor into it', () => {
    const current = createEditor();
    expect(insertAfterFirstParagraph(current, command('paragraph'))).toBe(true);

    const nodes = topLevel(current);
    expect(nodes.map((node) => node.type)).toEqual(['paragraph', 'paragraph']);
    expect(current.state.selection.$from.parent.type.name).toBe('paragraph');
  });

  it('creates headings with the requested level', () => {
    const current = createEditor();
    expect(insertAfterFirstParagraph(current, command('heading', { headingLevel: 3 }))).toBe(true);
    expect(topLevel(current)[1]).toMatchObject({ type: 'heading', attrs: { level: 3 } });

    expect(insertAfterFirstParagraph(current, command('heading'))).toBe(true);
    // The second insert lands right after the source paragraph, before the first heading.
    expect(topLevel(current)[1]).toMatchObject({ type: 'heading', attrs: { level: 1 } });
  });

  it('creates list and task wrappers', () => {
    const bulleted = createEditor();
    expect(insertAfterFirstParagraph(bulleted, command('bulletList'))).toBe(true);
    expect(topLevel(bulleted)[1]?.type).toBe('bulletList');

    const numbered = createEditor();
    expect(insertAfterFirstParagraph(numbered, command('orderedList'))).toBe(true);
    expect(topLevel(numbered)[1]?.type).toBe('orderedList');

    const tasks = createEditor();
    expect(insertAfterFirstParagraph(tasks, command('toDo'))).toBe(true);
    expect(topLevel(tasks)[1]?.type).toBe('taskList');
  });

  it('creates a toggle with an empty heading and a body paragraph', () => {
    const current = createEditor();
    expect(insertAfterFirstParagraph(current, command('toggle'))).toBe(true);

    const details = topLevel(current)[1];
    expect(details?.type).toBe('details');
    expect(details?.attrs['open']).toBe(true);
  });

  it('creates the remaining text and atomic blocks', () => {
    const cases: { kind: SlashCommandKind; type: string }[] = [
      { kind: 'quote', type: 'blockquote' },
      { kind: 'divider', type: 'horizontalRule' },
      { kind: 'table', type: 'table' },
      { kind: 'code', type: 'codeBlock' },
      { kind: 'image', type: 'image' },
      { kind: 'video', type: 'video' },
      { kind: 'file', type: 'file' },
      { kind: 'emoji', type: 'emoji' },
      { kind: 'equation', type: 'equationBlock' },
      { kind: 'linkToPage', type: 'pageLink' },
      { kind: 'breadcrumb', type: 'breadcrumbBlock' },
    ];

    for (const { kind, type } of cases) {
      const current = createEditor();
      expect({ kind, inserted: insertAfterFirstParagraph(current, command(kind)) }).toEqual({
        kind,
        inserted: true,
      });
      expect({ kind, node: topLevel(current)[1]?.type }).toEqual({ kind, node: type });
      current.destroy();
    }
  });

  it('creates columns with the requested count and a default of two', () => {
    const current = createEditor();
    expect(insertAfterFirstParagraph(current, command('columns', { columnsCount: 4 }))).toBe(true);

    const columns = current.getJSON().content?.[1];
    expect(columns?.type).toBe('columnsList');
    expect(columns?.content).toHaveLength(4);
    expect(columns?.content?.every((column) => column.type === 'columnsColumn')).toBe(true);

    expect(insertAfterFirstParagraph(current, command('columns'))).toBe(true);
    expect(current.getJSON().content?.[1]?.content).toHaveLength(2);
  });

  it('puts an inline equation inside a paragraph', () => {
    const current = createEditor();
    expect(insertAfterFirstParagraph(current, command('inlineEquation'))).toBe(true);

    const paragraph = current.getJSON().content?.[1];
    expect(paragraph?.type).toBe('paragraph');
    expect(paragraph?.content?.[0]?.type).toBe('inlineMath');
  });

  it('does not insert blocks that need an asynchronous service call', () => {
    for (const kind of ['page', 'database', 'databasePage', 'chart'] as const) {
      const current = createEditor();
      expect({ kind, inserted: insertAfterFirstParagraph(current, command(kind)) }).toEqual({
        kind,
        inserted: false,
      });
      expect(topLevel(current)).toHaveLength(1);
      current.destroy();
    }
  });
});

describe('insertBlockBelow: lists', () => {
  it('adds a sibling list item when the command matches the list kind', () => {
    const current = createEditor('<ul><li><p>One</p></li></ul>');
    const source = findBlockAtPosition(current, 1);
    expect(source?.node.type.name).toBe('listItem');

    expect(insertBlockBelow(current, source!, command('bulletList'))).toBe(true);

    const list = current.getJSON().content?.[0];
    expect(list?.type).toBe('bulletList');
    expect(list?.content).toHaveLength(2);
  });

  it('appends a task item to a task list', () => {
    const current = createEditor(
      '<ul data-type="taskList"><li data-type="taskItem"><p>One</p></li></ul>',
    );
    const source = findBlockAtPosition(current, 1);
    expect(source?.node.type.name).toBe('taskItem');

    expect(insertBlockBelow(current, source!, command('toDo'))).toBe(true);

    const list = current.getJSON().content?.[0];
    expect(list?.type).toBe('taskList');
    expect(list?.content).toHaveLength(2);
  });

  it('leaves the list when the command creates another block', () => {
    const current = createEditor('<ol><li><p>One</p></li></ol>');
    const source = findBlockAtPosition(current, 1);
    expect(source?.parent.type.name).toBe('orderedList');

    expect(insertBlockBelow(current, source!, command('paragraph'))).toBe(true);

    expect(topLevel(current).map((node) => node.type)).toEqual(['orderedList', 'paragraph']);
  });

  it('leaves a list for a list of another kind', () => {
    const current = createEditor('<ul><li><p>One</p></li></ul>');
    const source = findBlockAtPosition(current, 1);

    expect(insertBlockBelow(current, source!, command('orderedList'))).toBe(true);

    expect(topLevel(current).map((node) => node.type)).toEqual(['bulletList', 'orderedList']);
  });
});
