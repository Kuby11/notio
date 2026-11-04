import {
  type CalculationType,
  type Database,
  type DatabaseFilter,
  type DatabaseGroupBy,
  type DatabaseProperty,
  type DatabaseRow,
  type DatabaseSort,
  type DatabaseView,
  type DatePropertyValue,
  type PropertyFilter,
  type PropertyValue,
  type RollupConfig,
} from './database';
import { evaluateFormulaExpression } from './formula';
import { newId } from './ids';

/**
 * Checks whether a property value is considered empty.
 */
export function isValueEmpty(value: PropertyValue | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object' && 'start' in value) {
    return !value.start;
  }
  return false;
}

/**
 * Extracts a normalized string or scalar value for comparison from a PropertyValue.
 */
export function getComparableValue(
  value: PropertyValue | undefined,
): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    // For arrays of strings (multi-select, tags), join for search
    return value.join(', ');
  }
  if (typeof value === 'object' && 'start' in value) {
    return (value as DatePropertyValue).start;
  }
  return null;
}

/**
 * Evaluates a single PropertyFilter against a row.
 */
export function evaluatePropertyFilter(
  row: DatabaseRow,
  filter: PropertyFilter,
  propertiesMap: Map<string, DatabaseProperty>,
): boolean {
  const property = propertiesMap.get(filter.propertyId);
  const rawValue =
    filter.propertyId === 'title' || property?.type === 'title'
      ? row.title
      : row.properties[filter.propertyId];

  const { operator, value: targetValue } = filter;

  // Empty checks
  if (operator === 'is_empty') {
    return isValueEmpty(rawValue);
  }
  if (operator === 'is_not_empty') {
    return !isValueEmpty(rawValue);
  }

  // Checkbox operators
  if (operator === 'is_checked') {
    return rawValue === true;
  }
  if (operator === 'is_not_checked') {
    return rawValue !== true;
  }

  // If value is empty and operator is not empty check, it's false
  if (isValueEmpty(rawValue)) {
    return false;
  }

  // String / Text operators
  const stringVal =
    typeof rawValue === 'string'
      ? rawValue.toLowerCase()
      : typeof rawValue === 'number'
        ? String(rawValue)
        : '';
  const targetString = typeof targetValue === 'string' ? targetValue.toLowerCase() : '';

  if (operator === 'contains') {
    if (Array.isArray(rawValue)) {
      // For multi-select, person, relation: check if array contains target
      return rawValue.some((item) =>
        typeof item === 'string' && typeof targetValue === 'string'
          ? item.toLowerCase() === targetString
          : String(item) === String(targetValue),
      );
    }
    return stringVal.includes(targetString);
  }

  if (operator === 'does_not_contain') {
    if (Array.isArray(rawValue)) {
      return !rawValue.some((item) =>
        typeof item === 'string' && typeof targetValue === 'string'
          ? item.toLowerCase() === targetString
          : String(item) === String(targetValue),
      );
    }
    return !stringVal.includes(targetString);
  }

  if (operator === 'starts_with') {
    return stringVal.startsWith(targetString);
  }

  if (operator === 'ends_with') {
    return stringVal.endsWith(targetString);
  }

  if (operator === 'equals') {
    if (typeof rawValue === 'number' && typeof targetValue === 'number') {
      return rawValue === targetValue;
    }
    if (typeof rawValue === 'boolean' && typeof targetValue === 'boolean') {
      return rawValue === targetValue;
    }
    return stringVal === targetString;
  }

  if (operator === 'does_not_equal') {
    if (typeof rawValue === 'number' && typeof targetValue === 'number') {
      return rawValue !== targetValue;
    }
    if (typeof rawValue === 'boolean' && typeof targetValue === 'boolean') {
      return rawValue !== targetValue;
    }
    return stringVal !== targetString;
  }

  // Numerical / Date comparisons
  const numVal =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'object' && rawValue !== null && 'start' in rawValue
        ? new Date((rawValue as DatePropertyValue).start).getTime()
        : null;

  const targetNum =
    typeof targetValue === 'number'
      ? targetValue
      : typeof targetValue === 'string' && !isNaN(Date.parse(targetValue))
        ? new Date(targetValue).getTime()
        : typeof targetValue === 'string' && !isNaN(Number(targetValue))
          ? Number(targetValue)
          : null;

  if (numVal !== null && targetNum !== null) {
    if (operator === 'greater_than' || operator === 'after') {
      return numVal > targetNum;
    }
    if (operator === 'less_than' || operator === 'before') {
      return numVal < targetNum;
    }
    if (operator === 'greater_than_or_equal_to') {
      return numVal >= targetNum;
    }
    if (operator === 'less_than_or_equal_to') {
      return numVal <= targetNum;
    }
  }

  return false;
}

/**
 * Recursively evaluates a simple or compound filter (AND / OR).
 */
export function evaluateFilter(
  row: DatabaseRow,
  filter: DatabaseFilter,
  propertiesMap: Map<string, DatabaseProperty>,
): boolean {
  if ('and' in filter) {
    return filter.and.every((sub) => evaluateFilter(row, sub, propertiesMap));
  }
  if ('or' in filter) {
    return filter.or.some((sub) => evaluateFilter(row, sub, propertiesMap));
  }
  return evaluatePropertyFilter(row, filter, propertiesMap);
}

/**
 * Filters rows based on a DatabaseFilter.
 */
export function filterRows(
  rows: DatabaseRow[],
  filter: DatabaseFilter | undefined,
  properties: DatabaseProperty[],
): DatabaseRow[] {
  if (!filter) {
    return rows;
  }
  const propertiesMap = new Map(properties.map((p) => [p.id, p]));
  return rows.filter((row) => evaluateFilter(row, filter, propertiesMap));
}

/**
 * Compares two rows for sorting based on a list of sort definitions.
 */
export function compareRows(
  a: DatabaseRow,
  b: DatabaseRow,
  sorts: DatabaseSort[],
  propertiesMap: Map<string, DatabaseProperty>,
): number {
  for (const sort of sorts) {
    const property = propertiesMap.get(sort.propertyId);
    const valA =
      sort.propertyId === 'title' || property?.type === 'title'
        ? a.title
        : a.properties[sort.propertyId];
    const valB =
      sort.propertyId === 'title' || property?.type === 'title'
        ? b.title
        : b.properties[sort.propertyId];

    const aEmpty = isValueEmpty(valA);
    const bEmpty = isValueEmpty(valB);

    // In Notion, empty values are always sorted to the end regardless of direction
    if (aEmpty && bEmpty) continue;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    let comparison = 0;

    if (typeof valA === 'number' && typeof valB === 'number') {
      comparison = valA - valB;
    } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
      comparison = valA === valB ? 0 : valA ? 1 : -1;
    } else if (
      typeof valA === 'object' &&
      valA !== null &&
      'start' in valA &&
      typeof valB === 'object' &&
      valB !== null &&
      'start' in valB
    ) {
      comparison = (valA as DatePropertyValue).start.localeCompare(
        (valB as DatePropertyValue).start,
      );
    } else {
      const compA = String(getComparableValue(valA) ?? '');
      const compB = String(getComparableValue(valB) ?? '');
      comparison = compA.localeCompare(compB, undefined, { numeric: true, sensitivity: 'base' });
    }

    if (comparison !== 0) {
      return sort.direction === 'descending' ? -comparison : comparison;
    }
  }

  return 0;
}

/**
 * Sorts rows deterministically according to an array of sorts.
 */
export function sortRows(
  rows: DatabaseRow[],
  sorts: DatabaseSort[] | undefined,
  properties: DatabaseProperty[],
): DatabaseRow[] {
  if (!sorts || sorts.length === 0) {
    return rows;
  }
  const propertiesMap = new Map(properties.map((p) => [p.id, p]));
  return rows.toSorted((a, b) => compareRows(a, b, sorts, propertiesMap));
}

/**
 * Represents a group of rows (e.g. Kanban column or table section).
 */
export interface RowGroup {
  id: string; // Option ID or '__empty__'
  name: string; // Option name or 'No Status' / 'Uncategorized'
  color: string;
  rows: DatabaseRow[];
}

/**
 * Partitions rows into groups according to a DatabaseGroupBy definition.
 */
export function groupRows(
  rows: DatabaseRow[],
  groupBy: DatabaseGroupBy | undefined,
  properties: DatabaseProperty[],
): RowGroup[] {
  if (!groupBy) {
    return [
      {
        id: 'all',
        name: 'All',
        color: 'default',
        rows,
      },
    ];
  }

  const property = properties.find((p) => p.id === groupBy.propertyId);
  const groups: RowGroup[] = [];

  if (property?.type === 'status' && property.statusConfig?.options) {
    for (const opt of property.statusConfig.options) {
      groups.push({
        id: opt.id,
        name: opt.name,
        color: opt.color,
        rows: [],
      });
    }
  } else if (property?.type === 'select' && property.selectConfig?.options) {
    for (const opt of property.selectConfig.options) {
      groups.push({
        id: opt.id,
        name: opt.name,
        color: opt.color,
        rows: [],
      });
    }
  }

  const emptyGroup: RowGroup = {
    id: '__empty__',
    name: 'No ' + (property?.name ?? 'Value'),
    color: 'default',
    rows: [],
  };

  const groupMap = new Map<string, RowGroup>();
  for (const g of groups) {
    groupMap.set(g.id, g);
  }

  for (const row of rows) {
    const rawVal = row.properties[groupBy.propertyId];
    if (isValueEmpty(rawVal)) {
      emptyGroup.rows.push(row);
    } else {
      const valStr = String(rawVal);
      const targetGroup = groupMap.get(valStr);
      if (targetGroup) {
        targetGroup.rows.push(row);
      } else {
        // If an option wasn't in config, create ad-hoc group
        const newGroup: RowGroup = {
          id: valStr,
          name: valStr,
          color: 'default',
          rows: [row],
        };
        groups.push(newGroup);
        groupMap.set(valStr, newGroup);
      }
    }
  }

  const result = [...groups];
  if (!groupBy.hideEmpty || emptyGroup.rows.length > 0) {
    result.unshift(emptyGroup);
  }

  if (groupBy.sortDirection === 'descending') {
    result.reverse();
  }

  return result;
}

/**
 * Returns updated properties when moving a row to a target group (Kanban drag & drop).
 */
export function moveRowBetweenGroups(
  row: DatabaseRow,
  groupBy: DatabaseGroupBy,
  targetGroupId: string,
): Record<string, PropertyValue | null> {
  const newValue = targetGroupId === '__empty__' ? null : targetGroupId;
  return {
    ...row.properties,
    [groupBy.propertyId]: newValue,
  };
}

/**
 * Calculates aggregations / summary metrics for a column.
 */
export function calculateAggregation(
  rows: DatabaseRow[],
  propertyId: string,
  calculation: CalculationType,
  properties: DatabaseProperty[],
): number | string | null {
  const property = properties.find((p) => p.id === propertyId);
  const total = rows.length;

  if (calculation === 'count_all') {
    return total;
  }

  const values = rows.map((r) =>
    propertyId === 'title' || property?.type === 'title' ? r.title : r.properties[propertyId],
  );

  const nonEmptyValues = values.filter((v) => !isValueEmpty(v));
  const emptyCount = total - nonEmptyValues.length;

  if (calculation === 'count_values' || calculation === 'count_not_empty') {
    return nonEmptyValues.length;
  }
  if (calculation === 'count_empty') {
    return emptyCount;
  }
  if (calculation === 'percent_empty') {
    return total === 0 ? 0 : Math.round((emptyCount / total) * 100);
  }
  if (calculation === 'percent_not_empty') {
    return total === 0 ? 0 : Math.round((nonEmptyValues.length / total) * 100);
  }
  if (calculation === 'count_unique_values') {
    const unique = new Set(nonEmptyValues.map((v) => String(v)));
    return unique.size;
  }

  // Checkbox aggregations
  if (
    calculation === 'checked' ||
    calculation === 'unchecked' ||
    calculation === 'percent_checked' ||
    calculation === 'percent_unchecked'
  ) {
    const checkedCount = values.filter((v) => v === true).length;
    const uncheckedCount = total - checkedCount;
    if (calculation === 'checked') return checkedCount;
    if (calculation === 'unchecked') return uncheckedCount;
    if (calculation === 'percent_checked') {
      return total === 0 ? 0 : Math.round((checkedCount / total) * 100);
    }
    if (calculation === 'percent_unchecked') {
      return total === 0 ? 0 : Math.round((uncheckedCount / total) * 100);
    }
  }

  // Number aggregations
  const numbers = nonEmptyValues
    .map((v) => (typeof v === 'number' ? v : Number(v)))
    .filter((n) => !isNaN(n));

  if (numbers.length === 0) {
    return null;
  }

  if (calculation === 'sum') {
    return numbers.reduce((sum, n) => sum + n, 0);
  }
  if (calculation === 'average') {
    return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  }
  if (calculation === 'min') {
    return Math.min(...numbers);
  }
  if (calculation === 'max') {
    return Math.max(...numbers);
  }
  if (calculation === 'range') {
    return Math.max(...numbers) - Math.min(...numbers);
  }
  if (calculation === 'median') {
    const sorted = numbers.toSorted((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const midVal = sorted[mid] ?? 0;
    const prevVal = sorted[mid - 1] ?? 0;
    return sorted.length % 2 !== 0 ? midVal : (prevVal + midVal) / 2;
  }

  return null;
}

/**
 * Evaluates a Notion-like formula against one row.
 *
 * The expression is parsed, never executed as JavaScript: see
 * `evaluateFormulaExpression` for the supported syntax and the sandboxing
 * rationale. Invalid expressions evaluate to `null`.
 */
export function evaluateFormula(
  row: DatabaseRow,
  expression: string,
  properties: DatabaseProperty[],
): string | number | boolean | null {
  return evaluateFormulaExpression(row, expression, properties);
}

/**
 * Computes a rollup value from related rows.
 */
export function calculateRollup(
  row: DatabaseRow,
  rollupConfig: RollupConfig,
  targetRows: DatabaseRow[],
  targetProperties: DatabaseProperty[],
): number | string | null {
  const relationValue = row.properties[rollupConfig.relationPropertyId];
  if (!relationValue || !Array.isArray(relationValue) || relationValue.length === 0) {
    return rollupConfig.calculation.startsWith('count') ? 0 : null;
  }

  const relatedRows = targetRows.filter((r) => (relationValue as string[]).includes(r.id));
  return calculateAggregation(
    relatedRows,
    rollupConfig.targetPropertyId,
    rollupConfig.calculation as CalculationType,
    targetProperties,
  );
}

/**
 * Creates a default Notion-like starter database.
 */
export function createDefaultDatabase(
  workspaceId: string,
  title = 'Project Tasks',
  isInline = false,
): { database: Database; defaultRows: DatabaseRow[]; defaultViews: DatabaseView[] } {
  const dbId = newId();
  const now = new Date().toISOString();

  const titleProp: DatabaseProperty = {
    id: 'title',
    name: 'Name',
    type: 'title',
  };

  const statusProp: DatabaseProperty = {
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
  };

  const priorityProp: DatabaseProperty = {
    id: 'priority',
    name: 'Priority',
    type: 'select',
    selectConfig: {
      options: [
        { id: 'high', name: 'High', color: 'red' },
        { id: 'medium', name: 'Medium', color: 'yellow' },
        { id: 'low', name: 'Low', color: 'gray' },
      ],
    },
  };

  const dateProp: DatabaseProperty = {
    id: 'due_date',
    name: 'Due Date',
    type: 'date',
  };

  const doneProp: DatabaseProperty = {
    id: 'checkbox',
    name: 'Reviewed',
    type: 'checkbox',
  };

  const properties = [titleProp, statusProp, priorityProp, dateProp, doneProp];

  const tableViewId = newId();
  const boardViewId = newId();
  const chartViewId = newId();

  const tableView: DatabaseView = {
    id: tableViewId,
    databaseId: dbId,
    name: 'Table',
    type: 'table',
    sorts: [{ propertyId: 'title', direction: 'ascending' }],
    visiblePropertyIds: ['title', 'status', 'priority', 'due_date', 'checkbox'],
    columnWidths: {
      title: 240,
      status: 140,
      priority: 120,
      due_date: 140,
      checkbox: 90,
    },
    aggregations: [{ propertyId: 'title', calculation: 'count_all' }],
  };

  const boardView: DatabaseView = {
    id: boardViewId,
    databaseId: dbId,
    name: 'Board',
    type: 'board',
    groupBy: {
      propertyId: 'status',
      sortDirection: 'ascending',
      hideEmpty: false,
    },
    visiblePropertyIds: ['title', 'priority', 'due_date'],
    sorts: [],
  };

  const chartView: DatabaseView = {
    id: chartViewId,
    databaseId: dbId,
    name: 'Chart',
    type: 'chart_vertical',
    groupBy: {
      propertyId: 'status',
      sortDirection: 'ascending',
      hideEmpty: true,
    },
    visiblePropertyIds: [],
    sorts: [],
  };

  const database: Database = {
    id: dbId,
    workspaceId,
    parentId: null,
    title,
    isInline,
    properties,
    defaultViewId: tableViewId,
    isTrashed: false,
    createdBy: workspaceId,
    createdAt: now,
    updatedAt: now,
  };

  const defaultRows: DatabaseRow[] = [
    {
      id: newId(),
      databaseId: dbId,
      workspaceId,
      title: 'Design database architecture',
      properties: {
        status: 'done',
        priority: 'high',
        due_date: { start: '2026-11-01' },
        checkbox: true,
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
      title: 'Implement filtering and sorting engine',
      properties: {
        status: 'in_progress',
        priority: 'high',
        due_date: { start: '2026-11-03' },
        checkbox: false,
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
      title: 'Build table and board UI views',
      properties: {
        status: 'todo',
        priority: 'medium',
        due_date: { start: '2026-11-05' },
        checkbox: false,
      },
      isTrashed: false,
      createdBy: workspaceId,
      createdAt: now,
      updatedAt: now,
    },
  ];

  return { database, defaultRows, defaultViews: [tableView, boardView, chartView] };
}
