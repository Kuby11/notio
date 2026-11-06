// @vitest-environment jsdom
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TURN_INTO_OPTIONS,
  blockBackgroundOf,
  blockColorOf,
  canColorBlock,
  canTurnInto,
  currentTurnIntoOptionId,
  canUseMediaActions,
  deleteBlockAt,
  downloadBlockFile,
  duplicateBlockAt,
  setBlockColors,
  startReplaceSource,
  turnIntoBlock,
  turnIntoOptionsFor,
  type TurnIntoOption,
} from './block-actions';
import { findBlockAtPosition } from './block-insert';
import { editorExtensions } from './editor-extensions';

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function createEditor(content: Record<string, unknown>): Editor {
  const current = new Editor({ extensions: editorExtensions });

  current.commands.setContent({ type: 'doc', content: [content] });

  return current;
}

function firstBlock(current: Editor) {
  return blockAt(current, 0);
}

/** Position 0 for lists gives the list itself — the list item sits at position 1. */
function blockAt(current: Editor, position: number) {
  const block = findBlockAtPosition(current, position);

  if (!block) {
    throw new Error(`Блок на позиции ${position} не найден`);
  }

  return block;
}

function blockTypeNames(current: Editor): string[] {
  const types: string[] = [];

  current.state.doc.forEach((node) => {
    types.push(node.type.name);
  });

  return types;
}

function optionOf(id: string): TurnIntoOption {
  const option = TURN_INTO_OPTIONS.find((entry) => entry.id === id);

  if (!option) {
    throw new Error(`Опция ${id} не найдена`);
  }

  return option;
}

describe('turnIntoBlock', () => {
  it('превращает заголовок в цитату, сохраняя текст', () => {
    editor = createEditor({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Заголовок' }],
    });

    expect(turnIntoBlock(editor, firstBlock(editor), optionOf('quote'))).toBe(true);
    expect(blockTypeNames(editor)).toEqual(['blockquote']);
    expect(editor.state.doc.textContent).toBe('Заголовок');
  });

  it('превращает элемент нумерованного списка в цитату, поднимая его из списка', () => {
    editor = createEditor({
      type: 'orderedList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step' }] }],
        },
      ],
    });

    turnIntoBlock(editor, blockAt(editor, 1), optionOf('quote'));

    expect(blockTypeNames(editor)).toEqual(['blockquote']);
    expect(editor.state.doc.textContent).toBe('Step');
  });

  it('превращает toggle в текст, разворачивая дочерние блоки', () => {
    editor = createEditor({
      type: 'details',
      attrs: { open: true },
      content: [
        { type: 'detailsSummary', content: [{ type: 'text', text: 'Заголовок' }] },
        {
          type: 'detailsContent',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Child' }] }],
        },
      ],
    });

    turnIntoBlock(editor, firstBlock(editor), optionOf('text'));

    expect(blockTypeNames(editor)).toEqual(['paragraph', 'paragraph']);
    expect(editor.state.doc.textContent).toBe('ЗаголовокChild');
  });

  it('превращает абзац в код и обратно без потери текста', () => {
    editor = createEditor({ type: 'paragraph', content: [{ type: 'text', text: 'const x = 1;' }] });

    turnIntoBlock(editor, firstBlock(editor), optionOf('code'));

    const codeBlock = editor.state.doc.firstChild;

    expect(codeBlock?.type.name).toBe('codeBlock');
    expect(codeBlock?.textContent).toBe('const x = 1;');

    turnIntoBlock(editor, firstBlock(editor), optionOf('quote'));

    expect(blockTypeNames(editor)).toEqual(['blockquote']);
    expect(editor.state.doc.textContent).toBe('const x = 1;');
  });

  it('не делает ничего, если блок уже имеет выбранный тип', () => {
    editor = createEditor({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Заголовок' }],
    });

    expect(turnIntoBlock(editor, firstBlock(editor), optionOf('heading2'))).toBe(true);
    expect(blockTypeNames(editor)).toEqual(['heading']);
  });

  it('отказывается превращать атомарный блок', () => {
    editor = createEditor({ type: 'horizontalRule' });

    expect(turnIntoBlock(editor, firstBlock(editor), optionOf('text'))).toBe(false);
  });
});

describe('currentTurnIntoOptionId / canTurnInto / canColorBlock', () => {
  it('соотносит узлы с опциями превращения', () => {
    editor = createEditor({
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }],
        },
      ],
    });

    const item = blockAt(editor, 1);

    expect(currentTurnIntoOptionId(item)).toBe('bulletedList');
    expect(canTurnInto(item.node)).toBe(true);
    expect(canColorBlock(item.node)).toBe(true);
  });

  it('code-блок можно превратить, но нельзя раскрасить', () => {
    editor = createEditor({ type: 'codeBlock', content: [{ type: 'text', text: 'code' }] });

    expect(currentTurnIntoOptionId(firstBlock(editor))).toBe('code');
    expect(canTurnInto(firstBlock(editor).node)).toBe(true);
    expect(canColorBlock(firstBlock(editor).node)).toBe(false);
  });
});

describe('медиа-действия блока', () => {
  it('превращает изображение в файл, перенося источник', () => {
    editor = createEditor({
      type: 'image',
      attrs: {
        fileId: '00000000-0000-4000-8000-000000000010',
        url: null,
        caption: 'Caption',
        width: 50,
      },
    });

    const fileOption = { id: 'file', label: 'File', icon: '📎', kind: 'file' } as const;
    const moved = turnIntoBlock(editor, firstBlock(editor), fileOption);

    expect(moved).toBe(true);

    const file = editor.state.doc.firstChild;

    expect(file?.type.name).toBe('file');
    expect(file?.attrs['fileId']).toBe('00000000-0000-4000-8000-000000000010');
    expect(file?.attrs['name']).toBe('Caption');
    expect(canUseMediaActions(file!)).toBe(true);
  });

  it('у изображения цель превращения одна — файл', () => {
    editor = createEditor({
      type: 'image',
      attrs: { fileId: '00000000-0000-4000-8000-000000000010', url: null, caption: null },
    });

    expect(turnIntoOptionsFor(editor.state.doc.firstChild!)).toEqual([
      { id: 'file', label: 'File', icon: '📎', kind: 'file' },
    ]);
  });

  it('замена источника включает и выключает карточку', () => {
    editor = createEditor({
      type: 'image',
      attrs: { fileId: '00000000-0000-4000-8000-000000000010', url: null, caption: null },
    });

    startReplaceSource(editor, firstBlock(editor));
    expect(editor.state.doc.firstChild?.attrs['replacing']).toBe(true);

    // Downloading the source neither fails nor forgets the block.
    downloadBlockFile(editor, firstBlock(editor));
    expect(editor.state.doc.firstChild?.type.name).toBe('image');
  });

  it('без источника медиа-действия недоступны', () => {
    editor = createEditor({ type: 'image', attrs: { fileId: null, url: null, caption: null } });

    expect(canUseMediaActions(editor.state.doc.firstChild!)).toBe(false);
  });
});

describe('deleteBlockAt', () => {
  it('удаляет блок из середины документа', () => {
    editor = new Editor({
      extensions: editorExtensions,
      content: '<p>Первый</p><p>Второй</p><p>Третий</p>',
    });

    const second = findBlockAtPosition(editor, editor.state.doc.child(0).nodeSize);

    expect(second).not.toBeNull();

    if (second) {
      deleteBlockAt(editor, second);
    }

    expect(editor.state.doc.textContent).toBe('ПервыйТретий');
  });

  it('оставляет пустой абзац при удалении последнего блока', () => {
    editor = createEditor({ type: 'paragraph', content: [{ type: 'text', text: 'One' }] });

    deleteBlockAt(editor, firstBlock(editor));

    expect(blockTypeNames(editor)).toEqual(['paragraph']);
    expect(editor.state.doc.textContent).toBe('');
  });
});

describe('duplicateBlockAt', () => {
  it('дублирует блок и назначает копии новый blockId', () => {
    editor = createEditor({ type: 'paragraph', content: [{ type: 'text', text: 'Text' }] });

    duplicateBlockAt(editor, firstBlock(editor));

    expect(blockTypeNames(editor)).toEqual(['paragraph', 'paragraph']);
    expect(editor.state.doc.textContent).toBe('TextText');

    const ids: unknown[] = [];

    editor.state.doc.forEach((node) => {
      ids.push(node.attrs['blockId']);
    });

    expect(ids[0]).not.toBe(ids[1]);
  });
});

describe('setBlockColors', () => {
  it('ставит и сбрасывает цвета блока', () => {
    editor = createEditor({ type: 'paragraph', content: [{ type: 'text', text: 'Text' }] });

    const block = firstBlock(editor);

    setBlockColors(editor, block, { color: 'red', backgroundColor: 'blue' });

    const colored = firstBlock(editor).node;

    expect(blockColorOf(colored)).toBe('red');
    expect(blockBackgroundOf(colored)).toBe('blue');

    setBlockColors(editor, firstBlock(editor), { color: null, backgroundColor: null });

    const reset = firstBlock(editor).node;

    expect(blockColorOf(reset)).toBeNull();
    expect(blockBackgroundOf(reset)).toBeNull();
  });
});
