import { describe, expect, it } from 'vitest';
import {
  type DatabaseProperty,
  type DatabaseRow,
  DatabasePropertySchema,
  UpdateDatabaseInputSchema,
  UpdateRowInputSchema,
  UpdateViewInputSchema,
} from './database';
import {
  calculateAggregation,
  calculateRollup,
  compareRows,
  evaluatePropertyFilter,
  filterRows,
  getComparableValue,
  groupRows,
  isValueEmpty,
  sortRows,
} from './database-engine';
import { newId } from './ids';

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
  {
    id: 'priority',
    name: 'Priority',
    type: 'select',
    selectConfig: {
      options: [
        { id: 'high', name: 'High', color: 'red' },
        { id: 'low', name: 'Low', color: 'gray' },
      ],
    },
  },
  { id: 'estimate', name: 'Estimate', type: 'number' },
  { id: 'done', name: 'Done', type: 'checkbox' },
  { id: 'tags', name: 'Tags', type: 'multi_select' },
  { id: 'due', name: 'Due', type: 'date' },
  { id: 'note', name: 'Note', type: 'text' },
];

function makeRow(
  title: string,
  values: DatabaseRow['properties'],
  timestamps: { createdAt?: string; updatedAt?: string } = {},
): DatabaseRow {
  return {
    id: newId(),
    databaseId: dbId,
    workspaceId,
    title,
    properties: values,
    isTrashed: false,
    createdBy: workspaceId,
    createdAt: timestamps.createdAt ?? now,
    updatedAt: timestamps.updatedAt ?? now,
  };
}

const rows: DatabaseRow[] = [
  makeRow('Alpha Task', {
    status: 'todo',
    priority: 'high',
    estimate: 5,
    done: true,
    tags: ['frontend', 'backend'],
    due: { start: '2026-11-01' },
    note: 'Hello World',
  }),
  makeRow('Beta Task', {
    status: 'done',
    priority: 'low',
    estimate: 10,
    done: false,
    tags: ['backend'],
    due: { start: '2026-11-10' },
    note: 'hello there',
  }),
  makeRow('Gamma', {
    status: null,
    priority: null,
    estimate: null,
    done: false,
    tags: [],
    due: null,
    note: '',
  }),
];

function filterIds(
  filter: Parameters<typeof filterRows>[1],
  source: DatabaseRow[] = rows,
): string[] {
  return filterRows(source, filter, properties).map((row) => row.title);
}

describe('Value helpers', () => {
  it('detects empty values', () => {
    expect(isValueEmpty(undefined)).toBe(true);
    expect(isValueEmpty(null)).toBe(true);
    expect(isValueEmpty('   ')).toBe(true);
    expect(isValueEmpty([])).toBe(true);
    expect(isValueEmpty({ start: null } as never)).toBe(true);

    expect(isValueEmpty('x')).toBe(false);
    expect(isValueEmpty(0)).toBe(false);
    expect(isValueEmpty(false)).toBe(false);
    expect(isValueEmpty(['a'])).toBe(false);
    expect(isValueEmpty({ start: '2026-11-01' })).toBe(false);
  });

  it('normalises values for comparison', () => {
    expect(getComparableValue(undefined)).toBe(null);
    expect(getComparableValue(null)).toBe(null);
    expect(getComparableValue(3)).toBe(3);
    expect(getComparableValue(false)).toBe(false);
    expect(getComparableValue('text')).toBe('text');
    expect(getComparableValue([])).toBe(null);
    expect(getComparableValue(['a', 'b'])).toBe('a, b');
    expect(getComparableValue({ start: '2026-11-01' })).toBe('2026-11-01');
  });
});

describe('Filters: string operators', () => {
  it('matches contains, starts_with and ends_with case-insensitively', () => {
    expect(filterIds({ propertyId: 'note', operator: 'contains', value: 'HELLO' })).toEqual([
      'Alpha Task',
      'Beta Task',
    ]);
    expect(filterIds({ propertyId: 'title', operator: 'starts_with', value: 'beta' })).toEqual([
      'Beta Task',
    ]);
    expect(filterIds({ propertyId: 'title', operator: 'ends_with', value: 'Task' })).toEqual([
      'Alpha Task',
      'Beta Task',
    ]);
  });

  it('supports does_not_contain for text and arrays', () => {
    expect(filterIds({ propertyId: 'note', operator: 'does_not_contain', value: 'world' })).toEqual(
      ['Beta Task'],
    );
    expect(
      filterIds({ propertyId: 'tags', operator: 'does_not_contain', value: 'frontend' }),
    ).toEqual(['Beta Task']);
  });

  it('matches multi-select values exactly, ignoring case and other options', () => {
    expect(filterIds({ propertyId: 'tags', operator: 'contains', value: 'FRONTEND' })).toEqual([
      'Alpha Task',
    ]);
    expect(filterIds({ propertyId: 'tags', operator: 'contains', value: 'design' })).toEqual([]);
  });

  it('compares by equality and inequality', () => {
    expect(filterIds({ propertyId: 'title', operator: 'equals', value: 'alpha task' })).toEqual([
      'Alpha Task',
    ]);
    expect(filterIds({ propertyId: 'status', operator: 'equals', value: 'todo' })).toEqual([
      'Alpha Task',
    ]);
    expect(filterIds({ propertyId: 'estimate', operator: 'equals', value: 10 })).toEqual([
      'Beta Task',
    ]);
    expect(filterIds({ propertyId: 'done', operator: 'equals', value: true })).toEqual([
      'Alpha Task',
    ]);
    expect(filterIds({ propertyId: 'done', operator: 'does_not_equal', value: true })).toEqual([
      'Beta Task',
      'Gamma',
    ]);
    expect(filterIds({ propertyId: 'estimate', operator: 'does_not_equal', value: 5 })).toEqual([
      'Beta Task',
    ]);
    expect(
      filterIds({ propertyId: 'title', operator: 'does_not_equal', value: 'Alpha Task' }),
    ).toEqual(['Beta Task', 'Gamma']);
  });
});

describe('Filters: numbers, dates and emptiness', () => {
  it('compares numbers with all ordering operators', () => {
    expect(filterIds({ propertyId: 'estimate', operator: 'greater_than', value: 5 })).toEqual([
      'Beta Task',
    ]);
    expect(
      filterIds({ propertyId: 'estimate', operator: 'greater_than_or_equal_to', value: 5 }),
    ).toEqual(['Alpha Task', 'Beta Task']);
    expect(filterIds({ propertyId: 'estimate', operator: 'less_than', value: 10 })).toEqual([
      'Alpha Task',
    ]);
    expect(
      filterIds({ propertyId: 'estimate', operator: 'less_than_or_equal_to', value: 5 }),
    ).toEqual(['Alpha Task']);
  });

  it('compares dates with before and after', () => {
    expect(filterIds({ propertyId: 'due', operator: 'after', value: '2026-11-05' })).toEqual([
      'Beta Task',
    ]);
    expect(filterIds({ propertyId: 'due', operator: 'before', value: '2026-11-05' })).toEqual([
      'Alpha Task',
    ]);
  });

  it('treats empty cells as excluded from value operators', () => {
    expect(filterIds({ propertyId: 'estimate', operator: 'is_empty' })).toEqual(['Gamma']);
    expect(filterIds({ propertyId: 'estimate', operator: 'is_not_empty' })).toEqual([
      'Alpha Task',
      'Beta Task',
    ]);
    expect(filterIds({ propertyId: 'estimate', operator: 'greater_than', value: 0 })).toEqual([
      'Alpha Task',
      'Beta Task',
    ]);
    expect(filterIds({ propertyId: 'missing', operator: 'is_empty' })).toEqual([
      'Alpha Task',
      'Beta Task',
      'Gamma',
    ]);
  });

  it('handles checkbox emptiness and compound filters', () => {
    expect(filterIds({ propertyId: 'done', operator: 'is_not_checked' })).toEqual([
      'Beta Task',
      'Gamma',
    ]);
    expect(
      filterIds({
        or: [
          { and: [{ propertyId: 'status', operator: 'is_empty' }] },
          { propertyId: 'estimate', operator: 'greater_than', value: 8 },
        ],
      }),
    ).toEqual(['Beta Task', 'Gamma']);
  });

  it('evaluates a single filter directly', () => {
    const map = new Map(properties.map((property) => [property.id, property]));
    expect(
      evaluatePropertyFilter(rows[0]!, { propertyId: 'title', operator: 'is_not_empty' }, map),
    ).toBe(true);
    expect(
      evaluatePropertyFilter(rows[0]!, { propertyId: 'title', operator: 'is_empty' }, map),
    ).toBe(false);
  });

  it('returns the source rows when no filter is given', () => {
    expect(filterRows(rows, undefined, properties)).toBe(rows);
  });

  it('does not match ordering operators against unparseable values', () => {
    const row = makeRow('Odd', { note: 'abc' });
    expect(
      filterRows([row], { propertyId: 'note', operator: 'greater_than', value: 5 }, properties),
    ).toEqual([]);
  });
});

describe('Sorting', () => {
  it('sorts descending with empty values still last', () => {
    const sorted = sortRows(rows, [{ propertyId: 'title', direction: 'descending' }], properties);
    expect(sorted.map((row) => row.title)).toEqual(['Gamma', 'Beta Task', 'Alpha Task']);
  });

  it('sorts by date and boolean values', () => {
    const byDate = sortRows(rows, [{ propertyId: 'due', direction: 'ascending' }], properties);
    expect(byDate.map((row) => row.title)).toEqual(['Alpha Task', 'Beta Task', 'Gamma']);

    const byDone = sortRows(rows, [{ propertyId: 'done', direction: 'descending' }], properties);
    expect(byDone.map((row) => row.title)).toEqual(['Alpha Task', 'Beta Task', 'Gamma']);
  });

  it('falls through to the next sort when values tie', () => {
    const tied = [
      makeRow('Same', { estimate: 1 }, { createdAt: '2026-01-01T00:00:00.000Z' }),
      makeRow('Same', { estimate: 1 }, { createdAt: '2026-01-02T00:00:00.000Z' }),
    ];
    const desc = sortRows(
      tied,
      [
        { propertyId: 'estimate', direction: 'ascending' },
        { propertyId: 'title', direction: 'descending' },
      ],
      properties,
    );
    expect(desc).toHaveLength(2);

    const emptyBoth = sortRows(
      [makeRow('A', { estimate: null }), makeRow('B', { estimate: null })],
      [{ propertyId: 'estimate', direction: 'ascending' }],
      properties,
    );
    expect(emptyBoth.map((row) => row.title)).toEqual(['A', 'B']);
  });

  it('returns the source rows when there are no sorts', () => {
    expect(sortRows(rows, undefined, properties)).toBe(rows);
    expect(sortRows(rows, [], properties)).toBe(rows);
  });

  it('exposes the raw comparator', () => {
    const map = new Map(properties.map((property) => [property.id, property]));
    expect(
      compareRows(rows[0]!, rows[1]!, [{ propertyId: 'estimate', direction: 'ascending' }], map),
    ).toBeLessThan(0);
    expect(
      compareRows(rows[0]!, rows[1]!, [{ propertyId: 'estimate', direction: 'descending' }], map),
    ).toBeGreaterThan(0);
  });
});

describe('Grouping', () => {
  it('returns one group when there is no groupBy', () => {
    expect(groupRows(rows, undefined, properties)).toEqual([
      { id: 'all', name: 'All', color: 'default', rows },
    ]);
  });

  it('groups by select options and adds ad-hoc groups', () => {
    const groups = groupRows(
      rows,
      { propertyId: 'priority', sortDirection: 'ascending', hideEmpty: false },
      properties,
    );

    expect(groups.map((group) => group.id)).toEqual(['__empty__', 'high', 'low']);
    expect(groups.find((group) => group.id === 'high')?.rows).toHaveLength(1);
  });

  it('drops the empty group when hideEmpty is set', () => {
    const groups = groupRows(
      [rows[0]!],
      { propertyId: 'status', sortDirection: 'ascending', hideEmpty: true },
      properties,
    );

    expect(groups.map((group) => group.id)).toEqual(['todo', 'done']);
    expect(groups.find((group) => group.id === 'done')?.rows).toEqual([]);
  });

  it('reverses groups when sorted descending', () => {
    const groups = groupRows(
      rows,
      { propertyId: 'priority', sortDirection: 'descending', hideEmpty: true },
      properties,
    );

    expect(groups.map((group) => group.id)).toEqual(['low', 'high', '__empty__']);
  });

  it('creates groups for values that are not configured options', () => {
    const groups = groupRows(
      rows,
      { propertyId: 'status', sortDirection: 'ascending', hideEmpty: false },
      properties,
    );
    expect(groups.map((group) => group.id)).toEqual(['__empty__', 'todo', 'done']);
  });

  it('labels the empty group after the property, falling back for unknown ones', () => {
    const withProperty = groupRows(
      rows,
      { propertyId: 'priority', sortDirection: 'ascending', hideEmpty: false },
      properties,
    );
    expect(withProperty[0]?.name).toBe('No Priority');

    const withUnknown = groupRows(
      rows,
      { propertyId: 'nope', sortDirection: 'ascending', hideEmpty: false },
      properties,
    );
    expect(withUnknown[0]?.name).toBe('No Value');
    expect(withUnknown[0]?.rows).toHaveLength(3);
  });
});

describe('Aggregations', () => {
  it('counts values, empties and percentages', () => {
    expect(calculateAggregation([], 'title', 'count_all', properties)).toBe(0);
    expect(calculateAggregation(rows, 'estimate', 'count_not_empty', properties)).toBe(2);
    expect(calculateAggregation(rows, 'estimate', 'count_empty', properties)).toBe(1);
    expect(calculateAggregation(rows, 'estimate', 'percent_empty', properties)).toBe(33);
    expect(calculateAggregation(rows, 'estimate', 'percent_not_empty', properties)).toBe(67);
    expect(calculateAggregation([], 'estimate', 'percent_empty', properties)).toBe(0);
    expect(calculateAggregation([], 'estimate', 'percent_not_empty', properties)).toBe(0);
  });

  it('counts unique values', () => {
    expect(calculateAggregation(rows, 'status', 'count_unique_values', properties)).toBe(2);
    expect(calculateAggregation(rows, 'tags', 'count_unique_values', properties)).toBe(2);
  });

  it('counts checkboxes', () => {
    expect(calculateAggregation(rows, 'done', 'unchecked', properties)).toBe(2);
    expect(calculateAggregation(rows, 'done', 'percent_unchecked', properties)).toBe(67);
    expect(calculateAggregation([], 'done', 'percent_checked', properties)).toBe(0);
    expect(calculateAggregation([], 'done', 'percent_unchecked', properties)).toBe(0);
  });

  it('computes numeric aggregates from numbers and numeric strings', () => {
    const numeric = [makeRow('A', { estimate: 1 }), makeRow('B', { estimate: 3 })];
    expect(calculateAggregation(numeric, 'estimate', 'sum', properties)).toBe(4);
    expect(calculateAggregation(numeric, 'estimate', 'average', properties)).toBe(2);
    expect(calculateAggregation(numeric, 'estimate', 'min', properties)).toBe(1);
    expect(calculateAggregation(numeric, 'estimate', 'max', properties)).toBe(3);
    expect(calculateAggregation(numeric, 'estimate', 'range', properties)).toBe(2);

    const mixed = [
      makeRow('A', { estimate: 2 }),
      makeRow('B', { estimate: 1 }),
      makeRow('C', { estimate: 6 }),
      makeRow('D', { estimate: 8 }),
    ];
    expect(calculateAggregation(mixed, 'estimate', 'median', properties)).toBe(4);
    expect(calculateAggregation(numeric, 'estimate', 'median', properties)).toBe(2);
  });

  it('returns null when nothing is aggregatable', () => {
    expect(
      calculateAggregation([makeRow('A', { estimate: null })], 'estimate', 'sum', properties),
    ).toBe(null);
    expect(calculateAggregation(rows, 'note', 'sum', properties)).toBe(null);
    expect(calculateAggregation(rows, 'estimate', 'count_all', properties)).toBe(3);
  });
});

describe('Rollups', () => {
  const targetProperties: DatabaseProperty[] = [
    { id: 'title', name: 'Subtask', type: 'title' },
    { id: 'hours', name: 'Hours', type: 'number' },
  ];

  const subtasks = [makeRow('Sub 1', { hours: 2 }), makeRow('Sub 2', { hours: 3 })];

  it('aggregates related rows', () => {
    const parent = makeRow('Parent', { relation: [subtasks[0]!.id, subtasks[1]!.id] });
    expect(
      calculateRollup(
        parent,
        { relationPropertyId: 'relation', targetPropertyId: 'hours', calculation: 'sum' },
        subtasks,
        targetProperties,
      ),
    ).toBe(5);
  });

  it('returns zero for missing counts and null otherwise', () => {
    const empty = makeRow('Empty', {});
    expect(
      calculateRollup(
        empty,
        { relationPropertyId: 'relation', targetPropertyId: 'hours', calculation: 'count_all' },
        subtasks,
        targetProperties,
      ),
    ).toBe(0);
    expect(
      calculateRollup(
        empty,
        { relationPropertyId: 'relation', targetPropertyId: 'hours', calculation: 'sum' },
        subtasks,
        targetProperties,
      ),
    ).toBe(null);

    const unrelated = makeRow('Unrelated', { relation: [newId()] });
    expect(
      calculateRollup(
        unrelated,
        { relationPropertyId: 'relation', targetPropertyId: 'hours', calculation: 'count_all' },
        subtasks,
        targetProperties,
      ),
    ).toBe(0);
  });
});

describe('Input schemas reject empty updates', () => {
  it('requires at least one field', () => {
    expect(UpdateDatabaseInputSchema.safeParse({}).success).toBe(false);
    expect(UpdateRowInputSchema.safeParse({}).success).toBe(false);
    expect(UpdateViewInputSchema.safeParse({}).success).toBe(false);

    expect(UpdateDatabaseInputSchema.safeParse({ title: 'Data' }).success).toBe(true);
    expect(UpdateRowInputSchema.safeParse({ isTrashed: true }).success).toBe(true);
    expect(UpdateViewInputSchema.safeParse({ name: 'Board' }).success).toBe(true);
  });

  it('rejects malformed properties and accepts known ones', () => {
    expect(DatabasePropertySchema.safeParse({ id: 'x', name: 'X', type: 'unknown' }).success).toBe(
      false,
    );
    expect(DatabasePropertySchema.safeParse({ id: 'x', name: 'X', type: 'number' }).success).toBe(
      true,
    );
  });
});
