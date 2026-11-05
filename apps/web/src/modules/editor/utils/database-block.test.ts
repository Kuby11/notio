// @vitest-environment jsdom
import { Editor, type AnyExtension } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findBlockAtPosition } from './block-insert';
import {
  databaseBlockBridge,
  insertDatabaseAtSlash,
  insertDatabaseBelow,
  insertDatabasePageAtSlash,
  insertDatabasePageBelow,
  setDatabaseBlockBridge,
  type DatabaseBlockBridge,
  type DatabaseDraft,
} from './database-block';
import { editorExtensions } from './editor-extensions';
import type { SlashRange } from './slash';

const EXTENSIONS: AnyExtension[] = editorExtensions.map((extension) =>
  extension.name === 'starterKit' ? extension.configure({ dropcursor: false }) : extension,
);

let editor: Editor | null = null;

function createEditor(content = '<p>/database</p>'): Editor {
  editor = new Editor({ extensions: EXTENSIONS, content });

  return editor;
}

/** Absolute range of the first text node with this content. */
function textRange(current: Editor, text: string): SlashRange {
  let range: SlashRange | null = null;

  current.state.doc.descendants((node, position) => {
    if (range === null && node.isText && node.text === text) {
      range = { from: position, to: position + node.text.length };
      return false;
    }

    return true;
  });

  expect(range).not.toBeNull();

  return range!;
}

function deferredDraft(): {
  promise: Promise<DatabaseDraft | null>;
  resolve: (draft: DatabaseDraft | null) => void;
} {
  let settle: ((draft: DatabaseDraft | null) => void) | null = null;
  const promise = new Promise<DatabaseDraft | null>((resolve) => {
    settle = resolve;
  });

  return { promise, resolve: (draft) => settle?.(draft) };
}

function bridge(overrides: Partial<DatabaseBlockBridge> = {}): DatabaseBlockBridge {
  return {
    workspaceId: 'ws-1',
    createDatabase: async () => ({ id: 'db-1', title: 'Tasks' }),
    getDatabase: async () => ({ id: 'db-1', title: 'Tasks' }),
    openDatabase: vi.fn<(databaseId: string) => void>(),
    openCreatedDatabase: vi.fn<(databaseId: string) => void>(),
    ...overrides,
  };
}

function nodes(current: Editor) {
  return current.getJSON().content ?? [];
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe('database block bridge', () => {
  it('falls back to a no-op bridge', async () => {
    const current = createEditor();
    const fallback = databaseBlockBridge(current);

    expect(fallback.workspaceId).toBe('');
    await expect(fallback.createDatabase('inline')).resolves.toBeNull();
    await expect(fallback.getDatabase('db-1')).resolves.toBeNull();
    expect(() => fallback.openDatabase('db-1')).not.toThrow();
    expect(() => fallback.openCreatedDatabase('db-1')).not.toThrow();
  });

  it('returns the bridge assigned to the editor', () => {
    const current = createEditor();
    const assigned = bridge();

    setDatabaseBlockBridge(current, assigned);

    expect(databaseBlockBridge(current)).toBe(assigned);
  });
});

describe('insertDatabaseAtSlash', () => {
  it('inserts an inline database and links it to the created row', async () => {
    const current = createEditor();
    const assigned = bridge({
      createDatabase: async () => ({ id: 'db-1', title: 'Tasks', viewId: 'chart_vertical' }),
    });
    const createDatabase = vi.spyOn(assigned, 'createDatabase');
    setDatabaseBlockBridge(current, assigned);

    await expect(
      insertDatabaseAtSlash(current, textRange(current, '/database'), 'chart_vertical'),
    ).resolves.toBe(true);

    const [database, paragraph] = nodes(current);
    expect(database?.type).toBe('databaseBlock');
    expect(database?.attrs?.['databaseId']).toBe('db-1');
    expect(database?.attrs?.['viewId']).toBe('chart_vertical');
    expect(paragraph?.type).toBe('paragraph');
    expect(createDatabase).toHaveBeenCalledWith('inline', 'chart_vertical');
  });

  it('opens the created database page only for a whole-page block', async () => {
    const current = createEditor();
    const assigned = bridge();
    const openCreatedDatabase = vi.spyOn(assigned, 'openCreatedDatabase');
    setDatabaseBlockBridge(current, assigned);

    await expect(insertDatabasePageAtSlash(current, textRange(current, '/database'))).resolves.toBe(
      true,
    );

    const link = nodes(current)[0];
    expect(link?.type).toBe('databaseLink');
    expect(link?.attrs?.['databaseId']).toBe('db-1');
    expect(openCreatedDatabase).toHaveBeenCalledWith('db-1');
  });

  it('replaces the placeholder when the service fails', async () => {
    const current = createEditor();
    setDatabaseBlockBridge(current, bridge({ createDatabase: async () => null }));

    await expect(insertDatabaseAtSlash(current, textRange(current, '/database'))).resolves.toBe(
      false,
    );

    expect(nodes(current).map((node) => node.type)).toEqual(['paragraph']);
  });

  it('returns true but leaves the placeholder when the editor was destroyed', async () => {
    const current = createEditor();
    const pending = deferredDraft();
    setDatabaseBlockBridge(current, bridge({ createDatabase: async () => pending.promise }));

    const insertion = insertDatabaseAtSlash(current, textRange(current, '/database'));

    current.destroy();
    editor = null;
    pending.resolve({ id: 'db-late', title: 'Late' });

    await expect(insertion).resolves.toBe(true);
  });

  it('returns false when the editor was destroyed before a failed creation', async () => {
    const current = createEditor();
    const pending = deferredDraft();
    setDatabaseBlockBridge(current, bridge({ createDatabase: async () => pending.promise }));

    const insertion = insertDatabaseAtSlash(current, textRange(current, '/database'));

    current.destroy();
    editor = null;
    pending.resolve(null);

    await expect(insertion).resolves.toBe(false);
  });
});

describe('insertDatabaseBelow', () => {
  it('inserts an inline database under the block from the plus menu', async () => {
    const current = createEditor('<p>Above</p>');
    setDatabaseBlockBridge(current, bridge());
    const source = findBlockAtPosition(current, 0);

    await expect(insertDatabaseBelow(current, source!)).resolves.toBe(true);

    expect(nodes(current).map((node) => node.type)).toEqual([
      'paragraph',
      'databaseBlock',
      'paragraph',
    ]);
  });

  it('inserts a whole-page link below the block', async () => {
    const current = createEditor('<p>Above</p>');
    const assigned = bridge();
    const openCreatedDatabase = vi.spyOn(assigned, 'openCreatedDatabase');
    setDatabaseBlockBridge(current, assigned);
    const source = findBlockAtPosition(current, 0);

    await expect(insertDatabasePageBelow(current, source!)).resolves.toBe(true);

    expect(nodes(current).map((node) => node.type)).toEqual([
      'paragraph',
      'databaseLink',
      'paragraph',
    ]);
    expect(openCreatedDatabase).toHaveBeenCalledWith('db-1');
  });

  it('removes the placeholder on failure', async () => {
    const current = createEditor('<p>Above</p>');
    setDatabaseBlockBridge(current, bridge({ createDatabase: async () => null }));
    const source = findBlockAtPosition(current, 0);

    await expect(insertDatabaseBelow(current, source!)).resolves.toBe(false);

    // Only the atom is removed: the empty paragraph inserted under it stays as a cursor target.
    expect(nodes(current).map((node) => node.type)).toEqual(['paragraph', 'paragraph']);
  });

  it('keeps an existing empty paragraph when the insertion fails', async () => {
    const current = createEditor('<p>Above</p><p></p>');
    setDatabaseBlockBridge(current, bridge({ createDatabase: async () => null }));
    const source = findBlockAtPosition(current, 0);

    await expect(insertDatabaseBelow(current, source!)).resolves.toBe(false);

    expect(nodes(current).map((node) => node.type)).toEqual([
      'paragraph',
      'paragraph',
      'paragraph',
    ]);
  });
});
