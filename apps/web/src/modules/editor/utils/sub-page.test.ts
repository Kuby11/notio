// @vitest-environment jsdom
import { Editor } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SubPageDraft } from './sub-page';
import { insertSubPageAtSlash, insertSubPageBelow, setSubPageBridge } from './sub-page';
import { findBlockAtPosition } from './block-insert';
import { editorExtensions } from './editor-extensions';

let editor: Editor | null = null;

const DRAFT: SubPageDraft = {
  id: '00000000-0000-4000-8000-000000000013',
  title: '',
  icon: null,
};

afterEach(() => {
  editor?.destroy();
  editor = null;
});

function createEditorWithBridge(create: () => Promise<SubPageDraft | null>): Editor {
  const current = new Editor({ extensions: editorExtensions });

  setSubPageBridge(current, {
    createSubPage: create,
    openSubPage: vi.fn<(pageId: string) => void>(),
  });

  return current;
}

function subPageNodes(current: Editor): { pageId: unknown; title: unknown }[] {
  return (current.getJSON().content ?? []).flatMap((node) =>
    node.type === 'subPage'
      ? [{ pageId: node.attrs?.['pageId'] ?? null, title: node.attrs?.['title'] ?? null }]
      : [],
  );
}

describe('insertSubPageAtSlash', () => {
  it('заменяет пустой абзац ссылкой и дополняет её после создания страницы', async () => {
    const current = createEditorWithBridge(async () => DRAFT);
    editor = current;

    current.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] });
    current.commands.setTextSelection(1);

    const inserted = await insertSubPageAtSlash(current, { from: 1, to: 1 });

    expect(inserted).toBe(true);
    expect(subPageNodes(current)).toEqual([{ pageId: DRAFT.id, title: '' }]);

    // An empty paragraph remains after the link so typing can continue.
    const types = (current.getJSON().content ?? []).map((node) => node.type);
    expect(types).toEqual(['subPage', 'paragraph']);
  });

  it('убирает заглушку, если страницу создать не удалось', async () => {
    const current = createEditorWithBridge(async () => null);
    editor = current;

    current.commands.setContent({ type: 'doc', content: [{ type: 'paragraph' }] });
    current.commands.setTextSelection(1);

    const inserted = await insertSubPageAtSlash(current, { from: 1, to: 1 });

    expect(inserted).toBe(false);
    expect((current.getJSON().content ?? []).map((node) => node.type)).toEqual(['paragraph']);
  });

  it('вставляет ссылку после непустого блока, не удаляя его текст', async () => {
    const current = createEditorWithBridge(async () => DRAFT);
    editor = current;

    current.commands.setContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Текст' }] }],
    });
    current.commands.setTextSelection(6);

    await insertSubPageAtSlash(current, { from: 6, to: 6 });

    const types = (current.getJSON().content ?? []).map((node) => node.type);
    expect(types).toEqual(['paragraph', 'subPage', 'paragraph']);
    expect(current.state.doc.textContent).toContain('Текст');
  });
});

describe('insertSubPageBelow', () => {
  it('вставляет ссылку под блоком из plus-меню', async () => {
    const current = createEditorWithBridge(async () => DRAFT);
    editor = current;

    current.commands.setContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Строка' }] }],
    });

    const block = findBlockAtPosition(current, 0);

    expect(block).not.toBeNull();

    const inserted = block ? await insertSubPageBelow(current, block) : false;

    expect(inserted).toBe(true);
    expect(subPageNodes(current)).toEqual([{ pageId: DRAFT.id, title: '' }]);
  });

  it('выходит из списка: ссылка вставляется после всего списка', async () => {
    const current = createEditorWithBridge(async () => DRAFT);
    editor = current;

    current.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Пункт' }] }],
            },
          ],
        },
      ],
    });

    const block = findBlockAtPosition(current, 1);

    expect(block).not.toBeNull();

    if (block) {
      await insertSubPageBelow(current, block);
    }

    const document = current.getJSON();

    expect(document.content?.[0]?.type).toBe('bulletList');
    expect(document.content?.[1]?.type).toBe('subPage');
  });
});
