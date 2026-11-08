import { describe, expect, it } from 'vitest';
import type { Block, BlockContent } from '@notio/contracts';
import type { EditorBlockContent } from './block';
import { contentEquals, planAutosave, planMoves } from './autosave';

const PAGE_ID = '00000000-0000-4000-8000-000000000001';
const PARAGRAPH_ID = '00000000-0000-4000-8000-000000000101';
const HEADING_ID = '00000000-0000-4000-8000-000000000102';
const TODO_ID = '00000000-0000-4000-8000-000000000103';
const NEW_ID = '00000000-0000-4000-8000-000000000104';
const NOW = '2026-01-01T00:00:00.000Z';

function block(id: string, position: string, content: BlockContent): Block {
  return {
    id,
    pageId: PAGE_ID,
    type: content.type,
    position,
    content,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function entry(id: string | null, content: BlockContent): EditorBlockContent {
  return { id, content };
}

describe('contentEquals', () => {
  it('ignores key order and nesting', () => {
    expect(
      contentEquals(
        { type: 'toggle', content: 'Heading', open: false, children: [{ type: 'divider' }] },
        { children: [{ type: 'divider' }], open: false, content: 'Heading', type: 'toggle' },
      ),
    ).toBe(true);
  });

  it('sees changes in content and nested blocks', () => {
    expect(
      contentEquals({ type: 'paragraph', content: 'A' }, { type: 'paragraph', content: 'B' }),
    ).toBe(false);
    expect(
      contentEquals(
        {
          type: 'toggle',
          content: 'Heading',
          children: [{ type: 'toDo', checked: false, content: 'Task' }],
        },
        {
          type: 'toggle',
          content: 'Heading',
          children: [{ type: 'toDo', checked: true, content: 'Task' }],
        },
      ),
    ).toBe(false);
  });
});

describe('planAutosave', () => {
  const saved: Block[] = [
    block(PARAGRAPH_ID, 'a0', { type: 'paragraph', content: 'First' }),
    block(HEADING_ID, 'a1', { type: 'heading', level: 2, content: 'Heading' }),
    block(TODO_ID, 'a2', { type: 'toDo', checked: false, content: 'Task' }),
  ];

  it('plans no operations when the document is unchanged', () => {
    const plan = planAutosave(
      saved,
      saved.map((item) => entry(item.id, item.content)),
    );

    expect(plan).toEqual({
      deletes: [],
      updates: [],
      creates: [],
      order: [PARAGRAPH_ID, HEADING_ID, TODO_ID],
    });
  });

  it('updates changed blocks and preserves the order', () => {
    const plan = planAutosave(saved, [
      entry(PARAGRAPH_ID, { type: 'paragraph', content: 'First' }),
      entry(HEADING_ID, { type: 'heading', level: 2, content: 'New heading' }),
      entry(TODO_ID, { type: 'toDo', checked: true, content: 'Task' }),
    ]);

    expect(plan.updates).toEqual([
      { id: HEADING_ID, content: { type: 'heading', level: 2, content: 'New heading' } },
      { id: TODO_ID, content: { type: 'toDo', checked: true, content: 'Task' } },
    ]);
    expect(plan.creates).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.order).toEqual([PARAGRAPH_ID, HEADING_ID, TODO_ID]);
  });

  it('creates new blocks and deletes the missing ones', () => {
    const plan = planAutosave(saved, [
      entry(PARAGRAPH_ID, { type: 'paragraph', content: 'First' }),
      entry(NEW_ID, { type: 'paragraph', content: 'New' }),
      entry(TODO_ID, { type: 'toDo', checked: false, content: 'Task' }),
    ]);

    expect(plan.deletes).toEqual([HEADING_ID]);
    expect(plan.creates).toEqual([
      { clientId: NEW_ID, content: { type: 'paragraph', content: 'New' } },
    ]);
    expect(plan.order).toEqual([PARAGRAPH_ID, NEW_ID, TODO_ID]);
  });

  it('keys a block without an id and a repeat of a saved id', () => {
    const plan = planAutosave(saved.slice(0, 1), [
      entry(PARAGRAPH_ID, { type: 'paragraph', content: 'First' }),
      entry(PARAGRAPH_ID, { type: 'paragraph', content: 'Copy' }),
      entry(null, { type: 'paragraph', content: 'No id' }),
    ]);

    expect(plan.creates).toEqual([
      { clientId: 'new-block:1', content: { type: 'paragraph', content: 'Copy' } },
      { clientId: 'new-block:2', content: { type: 'paragraph', content: 'No id' } },
    ]);
    expect(plan.order).toEqual([PARAGRAPH_ID, 'new-block:1', 'new-block:2']);
  });
});

describe('planMoves', () => {
  it('does not move blocks whose order already matches', () => {
    expect(
      planMoves([PARAGRAPH_ID, HEADING_ID, TODO_ID], [PARAGRAPH_ID, HEADING_ID, TODO_ID]),
    ).toEqual([]);
  });

  it('moves a block back after it was reordered to the end', () => {
    expect(
      planMoves([PARAGRAPH_ID, HEADING_ID, TODO_ID], [PARAGRAPH_ID, TODO_ID, HEADING_ID]),
    ).toEqual([{ id: TODO_ID, afterBlockId: HEADING_ID }]);
  });

  it('moves a block to the start, shifting the others after it', () => {
    const moves = planMoves(
      [TODO_ID, PARAGRAPH_ID, HEADING_ID],
      [PARAGRAPH_ID, HEADING_ID, TODO_ID],
    );

    expect(moves).toEqual([
      { id: PARAGRAPH_ID, afterBlockId: TODO_ID },
      { id: HEADING_ID, afterBlockId: PARAGRAPH_ID },
    ]);
  });

  it('accounts for blocks appended by the service', () => {
    expect(planMoves([PARAGRAPH_ID, NEW_ID, TODO_ID], [PARAGRAPH_ID, TODO_ID, NEW_ID])).toEqual([
      { id: TODO_ID, afterBlockId: NEW_ID },
    ]);
  });
});
