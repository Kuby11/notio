// @vitest-environment jsdom
import { Editor, type AnyExtension } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { editorExtensions } from './editor-extensions';
import { applySlashCommand } from './slash-command';
import type { SlashCommand, SlashCommandKind, SlashRange } from './slash';

const EXTENSIONS: AnyExtension[] = editorExtensions.map((extension) =>
  extension.name === 'starterKit' ? extension.configure({ dropcursor: false }) : extension,
);

let editor: Editor | null = null;

function createEditor(content: string): Editor {
  editor = new Editor({ extensions: EXTENSIONS, content });

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

/** Absolute range of the first occurrence of `text` in the document. */
function textRange(current: Editor, text: string): SlashRange {
  let range: SlashRange | null = null;

  current.state.doc.descendants((node, position) => {
    if (range === null && node.isText && node.text !== undefined) {
      const offset = node.text.indexOf(text);

      if (offset !== -1) {
        range = { from: position + offset, to: position + offset + text.length };
        return false;
      }
    }

    return true;
  });

  expect(range).not.toBeNull();

  return range!;
}

function documentTypes(current: Editor): string[] {
  return (current.getJSON().content ?? []).map((node) => node.type);
}

/** Replaces `/command` in a paragraph and returns the resulting document. */
function run(
  kind: SlashCommandKind,
  extra: Partial<SlashCommand> = {},
  content = '<p>/command</p>',
) {
  const current = createEditor(content);
  const range = textRange(current, '/command');

  applySlashCommand(current, command(kind, extra), range);

  return current;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('applySlashCommand: line types', () => {
  it('turns a heading back into a paragraph', () => {
    const current = run('paragraph', {}, '<h1>/command</h1>');

    expect(documentTypes(current)).toEqual(['paragraph']);
    expect(current.getText()).toBe('');
  });

  it('creates headings with the requested level', () => {
    expect(documentTypes(run('heading', { headingLevel: 2 }))).toEqual(['heading']);
    expect(documentTypes(run('heading'))).toEqual(['heading']);

    const defaultLevel = run('heading');
    expect(defaultLevel.getJSON().content?.[0]?.attrs?.['level']).toBe(1);
  });

  it('turns the line into each list type', () => {
    expect(documentTypes(run('bulletList'))).toEqual(['bulletList']);
    expect(documentTypes(run('orderedList'))).toEqual(['orderedList']);
    expect(documentTypes(run('toDo'))).toEqual(['taskList']);
  });

  it('creates a toggle', () => {
    expect(documentTypes(run('toggle'))).toEqual(['details']);
  });

  it('creates quote and divider blocks', () => {
    expect(documentTypes(run('quote'))).toEqual(['blockquote']);
    // Dividers are atoms: Tiptap keeps an empty paragraph after them for the cursor.
    expect(documentTypes(run('divider'))).toEqual(['horizontalRule', 'paragraph']);
  });

  it('creates code and table blocks', () => {
    expect(documentTypes(run('code'))).toEqual(['codeBlock']);
    expect(documentTypes(run('table'))).toEqual(['table']);
  });
});

describe('applySlashCommand: atomic and media blocks', () => {
  it('inserts image, video and file blocks', () => {
    expect(documentTypes(run('image'))).toContain('image');
    expect(documentTypes(run('video'))).toContain('video');
    expect(documentTypes(run('file'))).toContain('file');
  });

  it('inserts an emoji block', () => {
    const json = run('emoji').getJSON();
    expect(JSON.stringify(json)).toContain('emoji');
  });

  it('inserts columns with the requested count', () => {
    const three = run('columns', { columnsCount: 3 });
    expect(documentTypes(three)).toEqual(['columnsList']);
    expect(three.getJSON().content?.[0]?.content).toHaveLength(3);

    const two = run('columns');
    expect(two.getJSON().content?.[0]?.content).toHaveLength(2);
  });

  it('inserts equations, a page link and breadcrumbs', () => {
    expect(documentTypes(run('equation'))).toContain('equationBlock');
    expect(JSON.stringify(run('inlineEquation').getJSON())).toContain('inlineMath');

    const link = run('linkToPage').getJSON();
    expect(JSON.stringify(link)).toContain('pageLink');

    expect(JSON.stringify(run('breadcrumb').getJSON())).toContain('breadcrumbBlock');
  });

  it('leaves the document untouched for asynchronously created blocks', () => {
    for (const kind of ['page', 'database', 'databasePage', 'chart'] as const) {
      const current = run(kind);

      expect({ kind, types: documentTypes(current) }).toEqual({ kind, types: ['paragraph'] });
      expect({ kind, text: current.getText() }).toEqual({ kind, text: '' });
      current.destroy();
    }
  });
});

describe('applySlashCommand: leaving lists', () => {
  it('removes the query inside a list item without breaking the list', () => {
    const current = run('quote', {}, '<ul><li><p>/command</p></li></ul>');

    // The chain applies deleteRange before liftListItem, and Tiptap evaluates the
    // lift against the pre-chain state: the item stays in place but the query is gone.
    expect(documentTypes(current)).toEqual(['bulletList']);
    expect(current.getText()).not.toContain('/command');
  });

  it('lifts a task item before turning it into a heading', () => {
    const current = run(
      'heading',
      { headingLevel: 2 },
      '<ul data-type="taskList"><li data-type="taskItem"><p>/command</p></li></ul>',
    );

    expect(documentTypes(current)).toEqual(['heading']);
    expect(current.getJSON().content?.[0]?.attrs?.['level']).toBe(2);
  });

  it('keeps list types inside the list', () => {
    const current = run('bulletList', {}, '<ul><li><p>/command</p></li></ul>');

    expect(documentTypes(current)).toEqual(['bulletList']);
    expect(current.getJSON().content?.[0]?.content).toHaveLength(1);
  });
});

describe('applySlashCommand: text around the query', () => {
  it('keeps the text before the slash', () => {
    const current = createEditor('<p>Hello /command</p>');
    const range = textRange(current, '/command');

    applySlashCommand(current, command('heading', { headingLevel: 3 }), range);

    expect(documentTypes(current)).toEqual(['heading']);
    expect(current.getText()).toBe('Hello ');
    expect(current.getJSON().content?.[0]?.attrs?.['level']).toBe(3);
  });

  it('keeps text that follows the query', () => {
    const current = createEditor('<p>/command world</p>');
    const range = textRange(current, '/command');

    applySlashCommand(current, command('heading', { headingLevel: 3 }), range);

    expect(current.getText()).toBe(' world');
  });
});
