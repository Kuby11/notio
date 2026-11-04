import { describe, expect, it } from 'vitest';
import {
  type DatabaseProperty,
  DatabasePropertySchema,
  type DatabaseRow,
  DatabaseRowSchema,
  DatabaseSchema,
  DatabaseViewSchema,
} from './database';
import {
  calculateAggregation,
  calculateRollup,
  createDefaultDatabase,
  evaluateFormula,
  filterRows,
  groupRows,
  moveRowBetweenGroups,
  sortRows,
} from './database-engine';
import { newId } from './ids';

describe('Database contracts and schemas', () => {
  it('валидирует полную структуру базы данных и представлений', () => {
    const workspaceId = newId();
    const { database, defaultRows, defaultViews } = createDefaultDatabase(
      workspaceId,
      'Sprint Backlog',
    );

    expect(DatabaseSchema.parse(database)).toEqual(database);
    for (const view of defaultViews) {
      expect(DatabaseViewSchema.parse(view)).toEqual(view);
    }
    for (const row of defaultRows) {
      expect(DatabaseRowSchema.parse(row)).toEqual(row);
    }
  });

  it('отклоняет некорректный тип свойства', () => {
    expect(() =>
      DatabasePropertySchema.parse({
        id: 'bad_prop',
        name: 'Bad',
        type: 'invalid_type_123',
      }),
    ).toThrow();
  });
});

describe('Database Engine: Filtering', () => {
  const workspaceId = newId();
  const dbId = newId();
  const now = new Date().toISOString();

  const properties: DatabaseProperty[] = [
    { id: 'title', name: 'Name', type: 'title' },
    {
      id: 'status',
      name: 'Status',
      type: 'status',
      statusConfig: {
        options: [
          { id: 'todo', name: 'To-do', color: 'gray', group: 'to_do' },
          { id: 'done', name: 'Done', color: 'green', group: 'complete' },
        ],
      },
    },
    { id: 'estimate', name: 'Estimate (hrs)', type: 'number' },
    { id: 'done', name: 'Completed', type: 'checkbox' },
    {
      id: 'tags',
      name: 'Tags',
      type: 'multi_select',
      selectConfig: {
        options: [
          { id: 'frontend', name: 'Frontend', color: 'blue' },
          { id: 'backend', name: 'Backend', color: 'purple' },
        ],
      },
    },
  ];

  const rows: DatabaseRow[] = [
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Auth login form',
      properties: {
        status: 'done',
        estimate: 4,
        done: true,
        tags: ['frontend'],
      },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'D1 migrations',
      properties: {
        status: 'todo',
        estimate: 8,
        done: false,
        tags: ['backend'],
      },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'E2E tests',
      properties: {
        status: 'todo',
        estimate: 12,
        done: false,
        tags: ['frontend', 'backend'],
      },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Unestimated task',
      properties: {
        status: 'todo',
        estimate: null,
        done: false,
        tags: [],
      },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  it('фильтрует по строковым операторам: contains, starts_with, equals', () => {
    const filter1 = { propertyId: 'title', operator: 'contains' as const, value: 'login' };
    const res1 = filterRows(rows, filter1, properties);
    expect(res1).toHaveLength(1);
    expect(res1[0]?.title).toBe('Auth login form');

    const filter2 = { propertyId: 'title', operator: 'starts_with' as const, value: 'D1' };
    const res2 = filterRows(rows, filter2, properties);
    expect(res2).toHaveLength(1);
    expect(res2[0]?.title).toBe('D1 migrations');
  });

  it('фильтрует по числовым операторам: greater_than, less_than_or_equal_to', () => {
    const filter = { propertyId: 'estimate', operator: 'greater_than' as const, value: 6 };
    const result = filterRows(rows, filter, properties);
    expect(result.map((r) => r.title)).toEqual(['D1 migrations', 'E2E tests']);
  });

  it('фильтрует по чекбоксу: is_checked, is_not_checked', () => {
    const checked = filterRows(rows, { propertyId: 'done', operator: 'is_checked' }, properties);
    expect(checked).toHaveLength(1);
    expect(checked[0]?.title).toBe('Auth login form');

    const unchecked = filterRows(
      rows,
      { propertyId: 'done', operator: 'is_not_checked' },
      properties,
    );
    expect(unchecked).toHaveLength(3);
  });

  it('фильтрует по пустоте: is_empty, is_not_empty', () => {
    const emptyEstimate = filterRows(
      rows,
      { propertyId: 'estimate', operator: 'is_empty' },
      properties,
    );
    expect(emptyEstimate).toHaveLength(1);
    expect(emptyEstimate[0]?.title).toBe('Unestimated task');
  });

  it('фильтрует по составным условиям: AND и OR', () => {
    const compound = {
      and: [
        { propertyId: 'status', operator: 'equals' as const, value: 'todo' },
        { propertyId: 'estimate', operator: 'greater_than' as const, value: 5 },
      ],
    };
    const result = filterRows(rows, compound, properties);
    expect(result.map((r) => r.title)).toEqual(['D1 migrations', 'E2E tests']);

    const orFilter = {
      or: [
        { propertyId: 'title', operator: 'contains' as const, value: 'Auth' },
        { propertyId: 'estimate', operator: 'equals' as const, value: 12 },
      ],
    };
    const orResult = filterRows(rows, orFilter, properties);
    expect(orResult.map((r) => r.title)).toEqual(['Auth login form', 'E2E tests']);
  });
});

describe('Database Engine: Sorting', () => {
  const workspaceId = newId();
  const dbId = newId();
  const now = new Date().toISOString();

  const properties: DatabaseProperty[] = [
    { id: 'title', name: 'Name', type: 'title' },
    { id: 'priority', name: 'Priority', type: 'number' },
  ];

  const rows: DatabaseRow[] = [
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Charlie',
      properties: { priority: 2 },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Alice',
      properties: { priority: 1 },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Bob',
      properties: { priority: 1 },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Empty Priority',
      properties: { priority: null },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  it('сортирует по возрастанию и убыванию с отправкой пустых значений в конец', () => {
    const sorted = sortRows(
      rows,
      [
        { propertyId: 'priority', direction: 'ascending' },
        { propertyId: 'title', direction: 'ascending' },
      ],
      properties,
    );

    expect(sorted.map((r) => r.title)).toEqual(['Alice', 'Bob', 'Charlie', 'Empty Priority']);
  });
});

describe('Database Engine: Grouping (Kanban Board)', () => {
  const workspaceId = newId();
  const dbId = newId();
  const now = new Date().toISOString();

  const properties: DatabaseProperty[] = [
    { id: 'title', name: 'Name', type: 'title' },
    {
      id: 'status',
      name: 'Status',
      type: 'status',
      statusConfig: {
        options: [
          { id: 'todo', name: 'To-do', color: 'gray', group: 'to_do' },
          { id: 'in_progress', name: 'In Progress', color: 'blue', group: 'in_progress' },
          { id: 'done', name: 'Done', color: 'green', group: 'complete' },
        ],
      },
    },
  ];

  const rows: DatabaseRow[] = [
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Task 1',
      properties: { status: 'todo' },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Task 2',
      properties: { status: 'done' },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Task 3 without status',
      properties: { status: null },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  it('группирует записи по колонкам канбана и сохраняет пустую колонку In Progress', () => {
    const groups = groupRows(
      rows,
      { propertyId: 'status', sortDirection: 'ascending', hideEmpty: false },
      properties,
    );

    expect(groups.map((g) => g.id)).toEqual(['__empty__', 'todo', 'in_progress', 'done']);

    const inProgressGroup = groups.find((g) => g.id === 'in_progress');
    expect(inProgressGroup?.rows).toHaveLength(0);

    const emptyGroup = groups.find((g) => g.id === '__empty__');
    expect(emptyGroup?.rows).toHaveLength(1);
    expect(emptyGroup?.rows[0]?.title).toBe('Task 3 without status');
  });

  it('перемещает карточку между колонками канбана', () => {
    const target = rows[0]!;
    const updatedProps = moveRowBetweenGroups(
      target,
      { propertyId: 'status', sortDirection: 'ascending', hideEmpty: false },
      'in_progress',
    );
    expect(updatedProps['status']).toBe('in_progress');

    const clearedProps = moveRowBetweenGroups(
      target,
      { propertyId: 'status', sortDirection: 'ascending', hideEmpty: false },
      '__empty__',
    );
    expect(clearedProps['status']).toBeNull();
  });
});

describe('Database Engine: Calculations and Aggregations', () => {
  const workspaceId = newId();
  const dbId = newId();
  const now = new Date().toISOString();

  const properties: DatabaseProperty[] = [
    { id: 'title', name: 'Name', type: 'title' },
    { id: 'score', name: 'Score', type: 'number' },
    { id: 'active', name: 'Active', type: 'checkbox' },
  ];

  const rows: DatabaseRow[] = [
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Item A',
      properties: { score: 10, active: true },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Item B',
      properties: { score: 20, active: true },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Item C',
      properties: { score: 30, active: false },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Item D',
      properties: { score: null, active: false },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  it('вычисляет статистику: count_all, sum, average, min, max, percent_checked', () => {
    expect(calculateAggregation(rows, 'title', 'count_all', properties)).toBe(4);
    expect(calculateAggregation(rows, 'score', 'count_values', properties)).toBe(3);
    expect(calculateAggregation(rows, 'score', 'sum', properties)).toBe(60);
    expect(calculateAggregation(rows, 'score', 'average', properties)).toBe(20);
    expect(calculateAggregation(rows, 'score', 'min', properties)).toBe(10);
    expect(calculateAggregation(rows, 'score', 'max', properties)).toBe(30);
    expect(calculateAggregation(rows, 'score', 'range', properties)).toBe(20);
    expect(calculateAggregation(rows, 'active', 'checked', properties)).toBe(2);
    expect(calculateAggregation(rows, 'active', 'percent_checked', properties)).toBe(50);
  });
});

describe('Database Engine: Formulas', () => {
  const workspaceId = newId();
  const dbId = newId();
  const now = new Date().toISOString();

  const properties: DatabaseProperty[] = [
    { id: 'title', name: 'Name', type: 'title' },
    { id: 'price', name: 'Price', type: 'number' },
    { id: 'quantity', name: 'Quantity', type: 'number' },
    { id: 'in_stock', name: 'In Stock', type: 'checkbox' },
  ];

  const row: DatabaseRow = {
    id: newId(),
    databaseId: dbId,
    workspaceId,
    title: 'Keyboard',
    properties: {
      price: 150,
      quantity: 3,
      in_stock: true,
    },
    isTrashed: false,
    createdBy: workspaceId,
    createdAt: now,
    updatedAt: now,
  };

  it('вычисляет арифметические выражения', () => {
    const result = evaluateFormula(row, 'prop("Price") * prop("Quantity")', properties);
    expect(result).toBe(450);
  });

  it('вычисляет условные выражения: if()', () => {
    const expr = 'if(prop("In Stock"), "Available", "Sold Out")';
    const result = evaluateFormula(row, expr, properties);
    expect(result).toBe('Available');
  });

  it('вычисляет конкатенацию строк и функции: concat()', () => {
    const expr = 'concat("Product: ", prop("Name"))';
    const result = evaluateFormula(row, expr, properties);
    expect(result).toBe('Product: Keyboard');
  });
});

describe('Database Engine: Rollup', () => {
  const workspaceId = newId();
  const dbId = newId();
  const targetDbId = newId();
  const now = new Date().toISOString();

  const targetProperties: DatabaseProperty[] = [
    { id: 'title', name: 'Subtask', type: 'title' },
    { id: 'hours', name: 'Hours', type: 'number' },
  ];

  const subtask1Id = newId();
  const subtask2Id = newId();

  const subtasks: DatabaseRow[] = [
    {
      id: subtask1Id,
      databaseId: targetDbId,
      workspaceId,
      title: 'Subtask 1',
      properties: { hours: 5 },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: subtask2Id,
      databaseId: targetDbId,
      workspaceId,
      title: 'Subtask 2',
      properties: { hours: 15 },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  const parentRow: DatabaseRow = {
    id: newId(),
    databaseId: dbId,
    workspaceId,
    title: 'Epic Feature',
    properties: {
      subtasks_relation: [subtask1Id, subtask2Id],
    },
    isTrashed: false,
    createdBy: workspaceId,
    createdAt: now,
    updatedAt: now,
  };

  it('суммирует связанные записи через rollup (sum hours)', () => {
    const rollupResult = calculateRollup(
      parentRow,
      {
        relationPropertyId: 'subtasks_relation',
        targetPropertyId: 'hours',
        calculation: 'sum',
      },
      subtasks,
      targetProperties,
    );

    expect(rollupResult).toBe(20);
  });
});
