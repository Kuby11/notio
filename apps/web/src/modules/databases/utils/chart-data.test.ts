import { describe, expect, it } from 'vitest';
import type { ChartConfig, DatabaseProperty, DatabaseRow, DatabaseView } from '@notio/contracts';
import { buildChartData, chartGroupProperty } from './chart-data';

const STATUS: DatabaseProperty = {
  id: 'status',
  name: 'Status',
  type: 'status',
  statusConfig: {
    options: [
      { id: 'todo', name: 'To-do', color: 'gray', group: 'to_do' },
      { id: 'done', name: 'Done', color: 'green', group: 'complete' },
    ],
  },
};

const TEXT: DatabaseProperty = { id: 'text', name: 'Notes', type: 'text' };
const AMOUNT: DatabaseProperty = { id: 'amount', name: 'Amount', type: 'number' };
const OWNER: DatabaseProperty = { id: 'owner', name: 'Owner', type: 'text' };

function chart(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    sort: 'count_desc',
    aggregation: 'count_all',
    referenceLines: [],
    color: 'auto',
    ...overrides,
  };
}

function row(id: string, status: string): DatabaseRow {
  return {
    id,
    databaseId: 'db-1',
    workspaceId: 'ws-1',
    title: id,
    properties: { status },
    isTrashed: false,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function view(type: DatabaseView['type'] = 'chart_vertical'): DatabaseView {
  return {
    id: 'view-1',
    databaseId: 'db-1',
    name: 'Chart',
    type,
    sorts: [],
    visiblePropertyIds: [],
  };
}

describe('buildChartData', () => {
  it('counts rows by status by default', () => {
    const data = buildChartData(
      [row('a', 'todo'), row('b', 'done'), row('c', 'todo')],
      [TEXT, STATUS],
      view(),
      { all: 'All rows', empty: 'No value' },
    );

    expect(data).toEqual([
      { name: 'To-do', value: 2, color: 'gray' },
      { name: 'Done', value: 1, color: 'green' },
    ]);
  });

  it('uses the explicit view grouping', () => {
    const data = buildChartData(
      [row('a', 'todo'), row('b', 'done')],
      [TEXT, STATUS],
      { groupBy: { propertyId: 'status', sortDirection: 'ascending', hideEmpty: true } },
      { all: 'All rows', empty: 'No value' },
    );

    expect(data.map((item) => item.value)).toEqual([1, 1]);
  });

  it('groups by a text property when it is selected', () => {
    const notes: DatabaseProperty = { id: 'notes', name: 'Notes', type: 'text' };
    const rows = [
      { ...row('a', 'todo'), properties: { notes: 'alpha' } },
      { ...row('b', 'done'), properties: { notes: 'beta' } },
      { ...row('c', 'todo'), properties: { notes: 'alpha' } },
    ];

    const data = buildChartData(
      rows,
      [notes, STATUS],
      { ...view(), chart: chart({ groupPropertyId: 'notes' }) },
      { all: 'All rows', empty: 'No value' },
    );

    expect(data).toEqual([
      { name: 'alpha', value: 2 },
      { name: 'beta', value: 1 },
    ]);
  });

  it('sorts labels by title when chosen in the settings', () => {
    const data = buildChartData(
      [row('a', 'todo'), row('b', 'done'), row('c', 'todo')],
      [TEXT, STATUS],
      { ...view(), chart: chart({ sort: 'label_asc' }) },
      { all: 'All rows', empty: 'No value' },
    );

    expect(data.map((item) => item.name)).toEqual(['Done', 'To-do']);
  });

  it('does not group when None is explicitly chosen in the settings', () => {
    const data = buildChartData(
      [row('a', 'todo'), row('b', 'done')],
      [TEXT, STATUS],
      { ...view(), chart: chart({ groupPropertyId: null }) },
      { all: 'All rows', empty: 'No value' },
    );

    expect(data).toEqual([{ name: 'All rows', value: 2 }]);
  });

  it('shows a single series when there is nothing to group by', () => {
    const data = buildChartData([row('a', 'todo'), row('b', 'done')], [TEXT], view(), {
      all: 'All rows',
      empty: 'No value',
    });

    expect(data).toEqual([{ name: 'All rows', value: 2 }]);
    expect(chartGroupProperty([TEXT], view())).toBeNull();
  });

  it('aggregates a numeric property and splits values across a second dimension', () => {
    const rows = [
      { ...row('a', 'todo'), properties: { status: 'todo', amount: 10, owner: 'Ann' } },
      { ...row('b', 'todo'), properties: { status: 'todo', amount: 5, owner: 'Bob' } },
      { ...row('c', 'done'), properties: { status: 'done', amount: 20, owner: 'Ann' } },
    ];
    const data = buildChartData(
      rows,
      [STATUS, AMOUNT, OWNER],
      {
        ...view(),
        chart: chart({
          groupPropertyId: 'status',
          valuePropertyId: 'amount',
          aggregation: 'sum',
          seriesPropertyId: 'owner',
        }),
      },
      { all: 'All rows', empty: 'No value' },
    );

    const todo = data.find((item) => item.name === 'To-do');

    expect(todo?.value).toBe(15);
    expect(todo?.series?.map(({ label, value }) => ({ label, value }))).toEqual([
      { label: 'Ann', value: 10 },
      { label: 'Bob', value: 5 },
    ]);
  });
});
