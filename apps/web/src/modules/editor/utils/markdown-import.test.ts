import { describe, expect, it } from 'vitest';
import { importTitleFrom, parseMarkdownToBlocks } from './markdown-import';

describe('parseMarkdownToBlocks', () => {
  it('разбирает заголовки уровней 1–4', () => {
    const blocks = parseMarkdownToBlocks('# Один\n## Два\n### Три\n#### Четыре');

    expect(blocks).toEqual([
      { type: 'heading', level: 1, content: 'Один' },
      { type: 'heading', level: 2, content: 'Два' },
      { type: 'heading', level: 3, content: 'Три' },
      { type: 'heading', level: 4, content: 'Четыре' },
    ]);
  });

  it('склеивает подряд идущие строки в один абзац', () => {
    const blocks = parseMarkdownToBlocks('первая строка\nвторая строка\n\nотдельный абзац');

    expect(blocks).toEqual([
      { type: 'paragraph', content: 'первая строка вторая строка' },
      { type: 'paragraph', content: 'отдельный абзац' },
    ]);
  });

  it('распознаёт списки, чекбоксы, цитаты и разделители', () => {
    const blocks = parseMarkdownToBlocks(
      '- пункт\n* ещё\n1. первый\n2) второй\n- [x] готово\n- [ ] план\n> мысль\n---',
    );

    expect(blocks).toEqual([
      { type: 'bulletedListItem', content: 'пункт' },
      { type: 'bulletedListItem', content: 'ещё' },
      { type: 'numberedListItem', content: 'первый' },
      { type: 'numberedListItem', content: 'второй' },
      { type: 'toDo', checked: true, content: 'готово' },
      { type: 'toDo', checked: false, content: 'план' },
      { type: 'quote', content: 'мысль' },
      { type: 'divider' },
    ]);
  });

  it('собирает код-фенс с языком и без', () => {
    const blocks = parseMarkdownToBlocks('```ts\nconst a = 1;\n```\n\n```\nплоский\n```');

    expect(blocks).toEqual([
      { type: 'code', language: 'ts', content: 'const a = 1;' },
      { type: 'code', language: null, content: 'плоский' },
    ]);
  });

  it('незакрытый код-фенс читается до конца текста', () => {
    const blocks = parseMarkdownToBlocks('```js\nconsole.log(1);');

    expect(blocks).toEqual([{ type: 'code', language: 'js', content: 'console.log(1);' }]);
  });

  it('пустой текст даёт пустой список блоков', () => {
    expect(parseMarkdownToBlocks('')).toEqual([]);
    expect(parseMarkdownToBlocks('\n\n  \n')).toEqual([]);
  });
});

describe('importTitleFrom', () => {
  it('берёт текст первого заголовка', () => {
    const blocks = parseMarkdownToBlocks('# План недели\nтекст');

    expect(importTitleFrom(blocks, 'notes.md', 'Резерв')).toBe('План недели');
  });

  it('без заголовка — имя файла без расширения', () => {
    expect(importTitleFrom([], 'мой-конспект.markdown', 'Резерв')).toBe('мой-конспект');
    expect(importTitleFrom([], 'док.txt', 'Резерв')).toBe('док');
  });

  it('пустое имя файла даёт резервный заголовок', () => {
    expect(importTitleFrom([], '', 'Резервная')).toBe('Резервная');
  });
});
