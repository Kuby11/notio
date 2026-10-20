// @vitest-environment jsdom
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SLASH_COMMANDS } from '../../utils/slash';
import { editorExtensions } from './editor-extensions';
import { applySlashCommand, findSlashTrigger } from './slash-command';

const editors: Editor[] = [];

function createEditor(content: string): Editor {
  const editor = new Editor({
    extensions: editorExtensions,
    content,
    element: document.createElement('div'),
  });

  editors.push(editor);

  return editor;
}

function command(id: string) {
  const found = SLASH_COMMANDS.find((item) => item.id === id);

  if (!found) {
    throw new Error(`Нет slash-команды ${id}`);
  }

  return found;
}

function typeInputRule(editor: Editor, text: string): boolean | void {
  const { from, to } = editor.state.selection;

  return editor.view.someProp('handleTextInput', (handler) =>
    handler(editor.view, from, to, text, () => editor.state.tr),
  );
}

afterEach(() => {
  for (const editor of editors.splice(0)) {
    editor.destroy();
  }
});

describe('findSlashTrigger', () => {
  it('находит команду в начале блока', () => {
    const editor = createEditor('<p>/h1</p>');
    editor.commands.setTextSelection(4);

    expect(findSlashTrigger(editor)).toEqual({
      query: 'h1',
      range: { from: 1, to: 4 },
    });
  });

  it('находит команду после текста', () => {
    const editor = createEditor('<p>text /h1</p>');
    editor.commands.setTextSelection(9);

    expect(findSlashTrigger(editor)).toEqual({
      query: 'h1',
      range: { from: 6, to: 9 },
    });
  });

  it('не срабатывает при выделении, в коде и внутри слова', () => {
    const selected = createEditor('<p>/h1</p>');
    selected.commands.setTextSelection({ from: 1, to: 4 });

    expect(findSlashTrigger(selected)).toBeNull();

    const code = createEditor('<pre><code>/h1</code></pre>');
    code.commands.setTextSelection(4);

    expect(findSlashTrigger(code)).toBeNull();

    const word = createEditor('<p>foo/bar</p>');
    word.commands.setTextSelection(8);

    expect(findSlashTrigger(word)).toBeNull();
  });
});

describe('applySlashCommand', () => {
  it('превращает блок в заголовок и удаляет запрос', () => {
    const editor = createEditor('<p>/h1</p>');

    applySlashCommand(editor, command('heading1'), { from: 1, to: 4 });

    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
    });
    expect(editor.getText()).toBe('');
  });

  it('превращает блок в toggle и to-do', () => {
    const toggleEditor = createEditor('<p>/toggle</p>');
    applySlashCommand(toggleEditor, command('toggle'), { from: 1, to: 8 });
    expect(toggleEditor.getJSON().content?.[0]?.type).toBe('toggle');

    const todoEditor = createEditor('<p>/todo</p>');
    applySlashCommand(todoEditor, command('checkList'), { from: 1, to: 6 });
    expect(todoEditor.getJSON().content?.[0]?.type).toBe('toDo');
  });

  it('создаёт маркированный и нумерованный списки', () => {
    const bulletEditor = createEditor('<p>/bullet</p>');
    applySlashCommand(bulletEditor, command('bulletedList'), { from: 1, to: 8 });
    expect(bulletEditor.getJSON().content?.[0]?.type).toBe('bulletList');

    const numberedEditor = createEditor('<p>/num</p>');
    applySlashCommand(numberedEditor, command('numberedList'), { from: 1, to: 5 });
    expect(numberedEditor.getJSON().content?.[0]?.type).toBe('orderedList');
  });

  it('возвращает заголовок к тексту и поддерживает H4', () => {
    const textEditor = createEditor('<h1>/text</h1>');
    applySlashCommand(textEditor, command('text'), { from: 1, to: 6 });
    expect(textEditor.getJSON().content?.[0]?.type).toBe('paragraph');

    const h4Editor = createEditor('<p>/h4</p>');
    applySlashCommand(h4Editor, command('heading4'), { from: 1, to: 4 });
    expect(h4Editor.getJSON().content?.[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 4 },
    });
  });
});

describe('markdown-триггеры', () => {
  it.each([
    ['#', 'heading', 1],
    ['##', 'heading', 2],
    ['###', 'heading', 3],
    ['####', 'heading', 4],
  ])('превращает %s в заголовок', (markdown, type, level) => {
    const editor = createEditor('<p></p>');
    editor.commands.insertContent(markdown);

    expect(typeInputRule(editor, ' ')).toBe(true);
    expect(editor.getJSON().content?.[0]).toMatchObject({ type, attrs: { level } });
  });

  it('превращает [] в to-do', () => {
    const editor = createEditor('<p></p>');
    editor.commands.insertContent('[]');

    expect(typeInputRule(editor, ' ')).toBe(true);
    expect(editor.getJSON().content?.[0]?.type).toBe('toDo');
  });

  it('превращает > в toggle, а не в цитату', () => {
    const editor = createEditor('<p></p>');
    editor.commands.insertContent('>');

    expect(typeInputRule(editor, ' ')).toBe(true);
    expect(editor.getJSON().content?.[0]?.type).toBe('toggle');
  });

  it('превращает - в маркированный список, а 1. — в нумерованный', () => {
    const bulletEditor = createEditor('<p></p>');
    bulletEditor.commands.insertContent('-');
    expect(typeInputRule(bulletEditor, ' ')).toBe(true);
    expect(bulletEditor.getJSON().content?.[0]?.type).toBe('bulletList');

    const numberedEditor = createEditor('<p></p>');
    numberedEditor.commands.insertContent('1.');
    expect(typeInputRule(numberedEditor, ' ')).toBe(true);
    expect(numberedEditor.getJSON().content?.[0]?.type).toBe('orderedList');
  });
});
