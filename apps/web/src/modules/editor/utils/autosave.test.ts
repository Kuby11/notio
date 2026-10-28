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
  it('не зависит от порядка ключей и вложенности', () => {
    expect(
      contentEquals(
        { type: 'toggle', content: 'Заголовок', open: false, children: [{ type: 'divider' }] },
        { children: [{ type: 'divider' }], open: false, content: 'Заголовок', type: 'toggle' },
      ),
    ).toBe(true);
  });

  it('видит изменения в содержимом и вложенных блоках', () => {
    expect(
      contentEquals({ type: 'paragraph', content: 'А' }, { type: 'paragraph', content: 'Б' }),
    ).toBe(false);
    expect(
      contentEquals(
        {
          type: 'toggle',
          content: 'Заголовок',
          children: [{ type: 'toDo', checked: false, content: 'Задача' }],
        },
        {
          type: 'toggle',
          content: 'Заголовок',
          children: [{ type: 'toDo', checked: true, content: 'Задача' }],
        },
      ),
    ).toBe(false);
  });
});

describe('planAutosave', () => {
  const saved: Block[] = [
    block(PARAGRAPH_ID, 'a0', { type: 'paragraph', content: 'Первый' }),
    block(HEADING_ID, 'a1', { type: 'heading', level: 2, content: 'Заголовок' }),
    block(TODO_ID, 'a2', { type: 'toDo', checked: false, content: 'Задача' }),
  ];

  it('не планирует операций, если документ не изменился', () => {
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

  it('обновляет изменённые блоки и сохраняет порядок', () => {
    const plan = planAutosave(saved, [
      entry(PARAGRAPH_ID, { type: 'paragraph', content: 'Первый' }),
      entry(HEADING_ID, { type: 'heading', level: 2, content: 'Новый заголовок' }),
      entry(TODO_ID, { type: 'toDo', checked: true, content: 'Задача' }),
    ]);

    expect(plan.updates).toEqual([
      { id: HEADING_ID, content: { type: 'heading', level: 2, content: 'Новый заголовок' } },
      { id: TODO_ID, content: { type: 'toDo', checked: true, content: 'Задача' } },
    ]);
    expect(plan.creates).toEqual([]);
    expect(plan.deletes).toEqual([]);
    expect(plan.order).toEqual([PARAGRAPH_ID, HEADING_ID, TODO_ID]);
  });

  it('создаёт новые блоки и удаляет пропавшие', () => {
    const plan = planAutosave(saved, [
      entry(PARAGRAPH_ID, { type: 'paragraph', content: 'Первый' }),
      entry(NEW_ID, { type: 'paragraph', content: 'Новый' }),
      entry(TODO_ID, { type: 'toDo', checked: false, content: 'Задача' }),
    ]);

    expect(plan.deletes).toEqual([HEADING_ID]);
    expect(plan.creates).toEqual([
      { clientId: NEW_ID, content: { type: 'paragraph', content: 'Новый' } },
    ]);
    expect(plan.order).toEqual([PARAGRAPH_ID, NEW_ID, TODO_ID]);
  });

  it('выдаёт ключ блоку без id и повтору сохранённого id', () => {
    const plan = planAutosave(saved.slice(0, 1), [
      entry(PARAGRAPH_ID, { type: 'paragraph', content: 'Первый' }),
      entry(PARAGRAPH_ID, { type: 'paragraph', content: 'Копия' }),
      entry(null, { type: 'paragraph', content: 'Без id' }),
    ]);

    expect(plan.creates).toEqual([
      { clientId: 'new-block:1', content: { type: 'paragraph', content: 'Копия' } },
      { clientId: 'new-block:2', content: { type: 'paragraph', content: 'Без id' } },
    ]);
    expect(plan.order).toEqual([PARAGRAPH_ID, 'new-block:1', 'new-block:2']);
  });
});

describe('planMoves', () => {
  it('не двигает блоки, порядок которых совпадает', () => {
    expect(
      planMoves([PARAGRAPH_ID, HEADING_ID, TODO_ID], [PARAGRAPH_ID, HEADING_ID, TODO_ID]),
    ).toEqual([]);
  });

  it('возвращает блок на место после перестановки в конец', () => {
    expect(
      planMoves([PARAGRAPH_ID, HEADING_ID, TODO_ID], [PARAGRAPH_ID, TODO_ID, HEADING_ID]),
    ).toEqual([{ id: TODO_ID, afterBlockId: HEADING_ID }]);
  });

  it('ставит блок в начало, перемещая остальные за ним', () => {
    const moves = planMoves(
      [TODO_ID, PARAGRAPH_ID, HEADING_ID],
      [PARAGRAPH_ID, HEADING_ID, TODO_ID],
    );

    expect(moves).toEqual([
      { id: PARAGRAPH_ID, afterBlockId: TODO_ID },
      { id: HEADING_ID, afterBlockId: PARAGRAPH_ID },
    ]);
  });

  it('учитывает блоки, добавленные сервисом в конец', () => {
    expect(planMoves([PARAGRAPH_ID, NEW_ID, TODO_ID], [PARAGRAPH_ID, TODO_ID, NEW_ID])).toEqual([
      { id: TODO_ID, afterBlockId: NEW_ID },
    ]);
  });
});
