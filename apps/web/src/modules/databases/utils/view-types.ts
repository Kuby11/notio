import type { DatabaseViewType } from '@notio/contracts';

/** Chart variants: every one can be switched to any other chart variant. */
export const CHART_VIEW_TYPES = [
  'chart_horizontal',
  'chart_vertical',
  'chart_donut',
  'chart_line',
  'chart_number',
] as const;

export type ChartViewType = (typeof CHART_VIEW_TYPES)[number];

export function isChartViewType(type: DatabaseViewType): type is ChartViewType {
  return (CHART_VIEW_TYPES as readonly string[]).includes(type);
}

/** Message key under `databases.views.types`. */
export const VIEW_TYPE_KEYS: Record<DatabaseViewType, string> = {
  table: 'table',
  board: 'board',
  list: 'list',
  gallery: 'gallery',
  calendar: 'calendar',
  timeline: 'timeline',
  chart_horizontal: 'chart_horizontal',
  chart_vertical: 'chart_vertical',
  chart_donut: 'chart_donut',
  chart_line: 'chart_line',
  chart_number: 'chart_number',
};
