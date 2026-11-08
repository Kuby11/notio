import { describe, expect, it } from 'vitest';
import { importTitleFrom, parseMarkdownToBlocks } from './markdown-import';

describe('parseMarkdownToBlocks', () => {
  it('parses headings of levels 1-4', () => {
    const blocks = parseMarkdownToBlocks('# One\n## Two\n### Three\n#### Four');

    expect(blocks).toEqual([
      { type: 'heading', level: 1, content: 'One' },
      { type: 'heading', level: 2, content: 'Two' },
      { type: 'heading', level: 3, content: 'Three' },
      { type: 'heading', level: 4, content: 'Four' },
    ]);
  });

  it('joins consecutive lines into one paragraph', () => {
    const blocks = parseMarkdownToBlocks('first line\nsecond line\n\nseparate paragraph');

    expect(blocks).toEqual([
      { type: 'paragraph', content: 'first line second line' },
      { type: 'paragraph', content: 'separate paragraph' },
    ]);
  });

  it('recognizes lists, checkboxes, quotes and dividers', () => {
    const blocks = parseMarkdownToBlocks(
      '- item\n* more\n1. first\n2) second\n- [x] done\n- [ ] todo\n> thought\n---',
    );

    expect(blocks).toEqual([
      { type: 'bulletedListItem', content: 'item' },
      { type: 'bulletedListItem', content: 'more' },
      { type: 'numberedListItem', content: 'first' },
      { type: 'numberedListItem', content: 'second' },
      { type: 'toDo', checked: true, content: 'done' },
      { type: 'toDo', checked: false, content: 'todo' },
      { type: 'quote', content: 'thought' },
      { type: 'divider' },
    ]);
  });

  it('collects a code fence with and without a language', () => {
    const blocks = parseMarkdownToBlocks('```ts\nconst a = 1;\n```\n\n```\nplain\n```');

    expect(blocks).toEqual([
      { type: 'code', language: 'ts', content: 'const a = 1;' },
      { type: 'code', language: null, content: 'plain' },
    ]);
  });

  it('reads an unclosed code fence to the end of the text', () => {
    const blocks = parseMarkdownToBlocks('```js\nconsole.log(1);');

    expect(blocks).toEqual([{ type: 'code', language: 'js', content: 'console.log(1);' }]);
  });

  it('gives an empty block list for empty text', () => {
    expect(parseMarkdownToBlocks('')).toEqual([]);
    expect(parseMarkdownToBlocks('\n\n  \n')).toEqual([]);
  });
});

describe('importTitleFrom', () => {
  it('takes the text of the first heading', () => {
    const blocks = parseMarkdownToBlocks('# Weekly plan\ntext');

    expect(importTitleFrom(blocks, 'notes.md', 'Fallback')).toBe('Weekly plan');
  });

  it('without a heading uses the file name without extension', () => {
    expect(importTitleFrom([], 'my-notes.markdown', 'Fallback')).toBe('my-notes');
    expect(importTitleFrom([], 'doc.txt', 'Fallback')).toBe('doc');
  });

  it('gives a fallback title for an empty file name', () => {
    expect(importTitleFrom([], '', 'Imported')).toBe('Imported');
  });
});
