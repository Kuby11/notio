import type { ChartViewType } from '../../utils/view-types';
import {
  BarChart3,
  BarChartHorizontal,
  Hash,
  LineChart,
  PieChart,
  type LucideIcon,
} from 'lucide-react';

const CHART_ICONS: Record<ChartViewType, LucideIcon> = {
  chart_horizontal: BarChartHorizontal,
  chart_vertical: BarChart3,
  chart_donut: PieChart,
  chart_line: LineChart,
  chart_number: Hash,
};

export function chartTypeIcon(type: ChartViewType): LucideIcon {
  return CHART_ICONS[type];
}
