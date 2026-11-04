import {
  calculateAggregation,
  groupRows,
  type ChartSortMode,
  type DatabaseProperty,
  type DatabaseRow,
  type DatabaseView,
} from '@notio/contracts';

export interface ChartSeriesDatum {
  key: string;
  label: string;
  value: number;
  color?: string;
}

export interface ChartDatum {
  name: string;
  value: number;
  /** Option colour from a status/select property, when available. */
  color?: string;
  /** Values for the optional second (Y group by) dimension. */
  series?: ChartSeriesDatum[];
}

/**
 * Property used for chart grouping.
 *
 * Chart settings win over the board-style groupBy. A null chart group is an
 * explicit "all rows" chart; a missing setting falls back to groupBy or the
 * first status/select property.
 */
export function chartGroupProperty(
  properties: readonly DatabaseProperty[],
  view: Pick<DatabaseView, 'groupBy' | 'chart'>,
): DatabaseProperty | null {
  if (view.chart?.groupPropertyId === null) {
    return null;
  }

  if (view.chart?.groupPropertyId) {
    const configured = properties.find((property) => property.id === view.chart?.groupPropertyId);

    if (configured) {
      return configured;
    }
  }

  if (view.groupBy) {
    const grouped = properties.find((property) => property.id === view.groupBy?.propertyId);

    if (grouped) {
      return grouped;
    }
  }

  return (
    properties.find((property) => property.type === 'status') ??
    properties.find((property) => property.type === 'select') ??
    null
  );
}

/** Property used for the optional Y-axis series split. */
export function chartSeriesProperty(
  properties: readonly DatabaseProperty[],
  view: Pick<DatabaseView, 'chart'>,
): DatabaseProperty | null {
  const id = view.chart?.seriesPropertyId;

  return id ? (properties.find((property) => property.id === id) ?? null) : null;
}

/**
 * Calculates the value shown by a bar/slice/number.
 *
 * Without a value property this is a row count. With one it uses the selected
 * numeric aggregation, matching the aggregation engine used by table columns.
 */
export function calculateChartValue(
  rows: readonly DatabaseRow[],
  properties: readonly DatabaseProperty[],
  chart: DatabaseView['chart'],
): number {
  const valuePropertyId = chart?.valuePropertyId ?? null;
  const aggregation = chart?.aggregation ?? 'count_all';

  if (!valuePropertyId || aggregation === 'count_all') {
    return rows.length;
  }

  const result = calculateAggregation([...rows], valuePropertyId, aggregation, [...properties]);

  return typeof result === 'number' && Number.isFinite(result) ? result : 0;
}

function valueLabel(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(String).join(', ') : null;
  }

  if (typeof value === 'object' && 'start' in value) {
    const start = (value as { start?: unknown }).start;
    return typeof start === 'string' && start.length > 0 ? start : null;
  }

  return String(value);
}

function sortData(data: ChartDatum[], mode: ChartSortMode): ChartDatum[] {
  switch (mode) {
    case 'count_asc':
      return data.toSorted((a, b) => a.value - b.value || a.name.localeCompare(b.name));
    case 'label_asc':
      return data.toSorted((a, b) => a.name.localeCompare(b.name));
    case 'label_desc':
      return data.toSorted((a, b) => b.name.localeCompare(a.name));
    case 'count_desc':
    default:
      return data.toSorted((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  }
}

interface ChartGroup {
  name: string;
  color?: string;
  rows: DatabaseRow[];
}

function chartGroups(
  rows: readonly DatabaseRow[],
  properties: readonly DatabaseProperty[],
  property: DatabaseProperty,
): ChartGroup[] {
  if (property.type === 'status' || property.type === 'select') {
    return groupRows(
      [...rows],
      {
        propertyId: property.id,
        sortDirection: 'ascending',
        hideEmpty: true,
      },
      [...properties],
    )
      .filter((group) => group.rows.length > 0)
      .map((group) => ({
        name: group.name,
        color: group.color,
        rows: group.rows,
      }));
  }

  // Charts can group by any scalar property, not only status/select. Unknown
  // empty values are omitted: a chart of values should not grow a blank bar.
  const groups = new Map<string, ChartGroup>();

  for (const row of rows) {
    const label = valueLabel(row.properties[property.id]);

    if (label === null) {
      continue;
    }

    const current = groups.get(label);

    if (current) {
      current.rows.push(row);
    } else {
      groups.set(label, { name: label, rows: [row] });
    }
  }

  return [...groups.values()];
}

export function buildChartData(
  rows: readonly DatabaseRow[],
  properties: readonly DatabaseProperty[],
  view: Pick<DatabaseView, 'groupBy' | 'chart'>,
  labels: { all: string; empty: string },
): ChartDatum[] {
  const property = chartGroupProperty(properties, view);
  const sort = view.chart?.sort ?? 'count_desc';
  const seriesProperty = chartSeriesProperty(properties, view);
  const seriesGroups = seriesProperty
    ? groupRows(
        [...rows],
        {
          propertyId: seriesProperty.id,
          sortDirection: 'ascending',
          hideEmpty: true,
        },
        [...properties],
      ).filter((group) => group.rows.length > 0)
    : [];
  const groups: ChartGroup[] = property
    ? chartGroups(rows, properties, property)
    : [{ name: labels.all, rows: [...rows] }];

  function toDatum(group: ChartGroup): ChartDatum {
    const series =
      seriesGroups.length === 0
        ? undefined
        : seriesGroups.map((seriesGroup, index) => {
            const rowIds = new Set(seriesGroup.rows.map((row) => row.id));
            const intersectingRows = group.rows.filter((row) => rowIds.has(row.id));

            return {
              key: `series_${index}`,
              label: seriesGroup.name,
              color: seriesGroup.color,
              value: calculateChartValue(intersectingRows, properties, view.chart),
            };
          });

    return {
      name: group.name || labels.empty,
      value: series
        ? series.reduce((sum, item) => sum + item.value, 0)
        : calculateChartValue(group.rows, properties, view.chart),
      color: group.color,
      ...(series ? { series } : {}),
    };
  }

  return sortData(groups.map(toDatum), sort);
}
