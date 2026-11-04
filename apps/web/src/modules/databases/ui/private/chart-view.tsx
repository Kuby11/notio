'use client';

import type {
  ChartColorMode,
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
  DatabaseViewType,
  UpdateViewInput,
} from '@notio/contracts';
import { Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  XAxis,
  YAxis,
  type PieLabelRenderProps,
} from 'recharts';
import { Button } from '@/shared/ui/button';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '../../../../shared/ui/chart';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../shared/ui/dropdown-menu';
import {
  buildChartData,
  calculateChartValue,
  chartGroupProperty,
  type ChartSeriesDatum,
} from '../../utils/chart-data';
import { CHART_VIEW_TYPES, isChartViewType, VIEW_TYPE_KEYS } from '../../utils/view-types';
import { ChartSettingsSheet } from './chart-settings-sheet';
import { chartTypeIcon } from './chart-type-icon';

const SERIES_COLORS: Record<string, string> = {
  default: '#d8d4c8',
  gray: '#d8d4c8',
  brown: '#a1887f',
  orange: '#e6a15c',
  yellow: '#e5c07b',
  green: '#6cc48e',
  blue: '#5b9bd5',
  purple: '#b48ead',
  pink: '#e39ac4',
  red: '#e57373',
};

const COLOR_PALETTES: Record<Exclude<ChartColorMode, 'auto'>, string[]> = {
  green: ['#6cc48e', '#4ea875', '#8ed6a8', '#b7e4c7', '#2f7d58'],
  blue: ['#5b9bd5', '#3f7fb8', '#83b9e6', '#a9d0f2', '#2b5f8f'],
  purple: ['#b48ead', '#946a8e', '#c9a7c4', '#dcc3d8', '#704d6c'],
  orange: ['#e6a15c', '#cd7f36', '#f0bb87', '#f6d3b2', '#a76022'],
  red: ['#e57373', '#c94f4f', '#ef9a9a', '#f5c1c1', '#9d3434'],
};

function seriesColor(
  datum: Pick<ChartSeriesDatum, 'color'>,
  index: number,
  mode: ChartColorMode,
): string {
  const palette = mode === 'auto' ? undefined : COLOR_PALETTES[mode];
  const explicitColor =
    datum.color && datum.color !== 'default' ? SERIES_COLORS[datum.color] : undefined;

  return (
    palette?.[index % palette.length] ??
    explicitColor ??
    ['#6cc48e', '#5b9bd5', '#d8d4c8', '#e5c07b', '#b48ead', '#e39ac4'][index % 6] ??
    '#d8d4c8'
  );
}

function primaryColor(mode: ChartColorMode): string {
  return mode === 'auto' ? '#6cc48e' : (COLOR_PALETTES[mode][0] ?? '#6cc48e');
}

/**
 * Outside labels for the donut: value and percent, connected by a short elbow
 * leader. Recharts supplies the geometry for each slice.
 */
function donutLabel(props: PieLabelRenderProps) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const value = Number(props.value ?? 0);
  const percent = Number(props.percent ?? 0);
  const radius = Math.PI / 180;
  const cos = Math.cos(-midAngle * radius);
  const sin = Math.sin(-midAngle * radius);

  if (![cx, cy, midAngle, outerRadius, value, percent].every(Number.isFinite)) {
    return null;
  }

  const startX = cx + (outerRadius + 3) * cos;
  const startY = cy + (outerRadius + 3) * sin;
  const elbowX = cx + (outerRadius + 18) * cos;
  const elbowY = cy + (outerRadius + 18) * sin;
  const endX = elbowX + (cos >= 0 ? 12 : -12);
  const label = `${value} (${Math.round(percent * 100)}%)`;

  return (
    <g>
      <polyline
        points={`${startX},${startY} ${elbowX},${elbowY} ${endX},${elbowY}`}
        fill="none"
        stroke="var(--border)"
        strokeWidth={1}
      />
      <text
        x={endX + (cos >= 0 ? 5 : -5)}
        y={elbowY}
        textAnchor={cos >= 0 ? 'start' : 'end'}
        dominantBaseline="middle"
        fill="var(--muted-foreground)"
        fontSize={11}
      >
        {label}
      </text>
    </g>
  );
}

export interface ChartViewProps {
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  view: DatabaseView;
  databaseTitle: string;
  onChangeType: (type: DatabaseViewType) => void;
  onUpdateView: (input: UpdateViewInput) => void;
}

/**
 * Database chart view.
 *
 * Every chart type is the same view data with a different renderer, so the
 * selector in the header can switch horizontal/vertical/donut/line/number
 * without losing the view settings.
 */
export function ChartView({
  properties,
  rows,
  view,
  databaseTitle,
  onChangeType,
  onUpdateView,
}: ChartViewProps) {
  const t = useTranslations('databases.views');
  const tChart = useTranslations('databases.chart');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chartType = isChartViewType(view.type) ? view.type : 'chart_vertical';
  const groupProperty = chartGroupProperty(properties, view);
  const colorMode = view.chart?.color ?? 'auto';
  const data = useMemo(
    () =>
      buildChartData(rows, properties, view, {
        all: tChart('allRows'),
        empty: tChart('noValue'),
      }),
    [rows, properties, view, tChart],
  );
  const seriesInfo = data[0]?.series ?? [];
  const flatData = useMemo(
    () =>
      data.map((datum) => ({
        name: datum.name,
        value: datum.value,
        ...Object.fromEntries((datum.series ?? []).map((series) => [series.key, series.value])),
      })),
    [data],
  );
  const config: ChartConfig = {
    value: { label: tChart('rowCount'), color: primaryColor(colorMode) },
    ...Object.fromEntries(
      seriesInfo.map((series, index) => [
        series.key,
        { label: series.label, color: seriesColor(series, index, colorMode) },
      ]),
    ),
  };
  const range = view.chart?.range;
  const yDomain: [number | 'auto', number | 'auto'] =
    range?.mode === 'custom' ? [range.min ?? 'auto', range.max ?? 'auto'] : ['auto', 'auto'];
  const referenceLines = view.chart?.referenceLines ?? [];
  const valueProperty = properties.find((property) => property.id === view.chart?.valuePropertyId);
  const TypeIcon = chartTypeIcon(chartType);
  const numberValue = calculateChartValue(rows, properties, view.chart);
  const numberLabel =
    typeof numberValue === 'number' && !Number.isInteger(numberValue)
      ? numberValue.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : numberValue;

  function seriesLegend() {
    if (seriesInfo.length === 0) {
      return null;
    }

    return (
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {seriesInfo.map((series, index) => (
          <span key={series.key} className="flex items-center gap-1.5 text-xs">
            <span
              className="size-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: seriesColor(series, index, colorMode) }}
              aria-hidden="true"
            />
            <span className="text-muted-foreground">{series.label}</span>
          </span>
        ))}
      </div>
    );
  }

  function chartBody() {
    if (chartType === 'chart_number') {
      return (
        <div className="flex h-[320px] flex-col items-center justify-center gap-2">
          <span className="text-5xl font-semibold tracking-tight tabular-nums">{numberLabel}</span>
          <span className="text-muted-foreground text-sm">
            {valueProperty
              ? tChart('totalOf', { property: valueProperty.name })
              : tChart('totalRows')}
          </span>
        </div>
      );
    }

    if (rows.length === 0 || data.length === 0) {
      return (
        <div className="text-muted-foreground flex h-[320px] items-center justify-center text-sm">
          {tChart('empty')}
        </div>
      );
    }

    if (chartType === 'chart_donut') {
      const total = data.reduce((sum, item) => sum + item.value, 0);

      return (
        <div className="pb-2">
          <div className="relative">
            <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
              <PieChart margin={{ top: 8, right: 48, bottom: 8, left: 48 }}>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={94}
                  stroke="var(--card)"
                  strokeWidth={2}
                  label={donutLabel}
                  labelLine={false}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={seriesColor(entry, index, colorMode)} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-semibold tracking-tight tabular-nums">{total}</span>
              <span className="text-muted-foreground mt-1 text-xs">{tChart('total')}</span>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {data.map((entry, index) => (
              <span key={entry.name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: seriesColor(entry, index, colorMode) }}
                  aria-hidden="true"
                />
                <span className="text-muted-foreground">{entry.name}</span>
              </span>
            ))}
          </div>
        </div>
      );
    }

    if (chartType === 'chart_line') {
      return (
        <>
          <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
            <LineChart data={flatData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                domain={yDomain}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {referenceLines.map((value, index) => (
                <ReferenceLine
                  key={`reference-${index}`}
                  y={value}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
              ))}
              {seriesInfo.length > 0 ? (
                seriesInfo.map((series, index) => (
                  <Line
                    key={series.key}
                    type="monotone"
                    dataKey={series.key}
                    stroke={seriesColor(series, index, colorMode)}
                    strokeWidth={2}
                    dot={false}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={primaryColor(colorMode)}
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </LineChart>
          </ChartContainer>
          {seriesLegend()}
        </>
      );
    }

    if (chartType === 'chart_horizontal') {
      return (
        <>
          <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
            <BarChart
              layout="vertical"
              data={flatData}
              margin={{ top: 8, right: 20, bottom: 8, left: 8 }}
            >
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                domain={yDomain}
              />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={104} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {referenceLines.map((value, index) => (
                <ReferenceLine
                  key={`reference-${index}`}
                  x={value}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
              ))}
              {seriesInfo.length > 0 ? (
                seriesInfo.map((series, index) => (
                  <Bar
                    key={series.key}
                    dataKey={series.key}
                    stackId="series"
                    fill={seriesColor(series, index, colorMode)}
                  />
                ))
              ) : (
                <Bar dataKey="value" fill={primaryColor(colorMode)} radius={[0, 6, 6, 0]} />
              )}
            </BarChart>
          </ChartContainer>
          {seriesLegend()}
        </>
      );
    }

    return (
      <>
        <ChartContainer config={config} className="aspect-auto h-[320px] w-full">
          <BarChart data={flatData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} interval={0} />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
              domain={yDomain}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            {referenceLines.map((value, index) => (
              <ReferenceLine
                key={`reference-${index}`}
                y={value}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
            ))}
            {seriesInfo.length > 0 ? (
              seriesInfo.map((series, index) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  stackId="series"
                  fill={seriesColor(series, index, colorMode)}
                />
              ))
            ) : (
              <Bar dataKey="value" fill={primaryColor(colorMode)} radius={[6, 6, 0, 0]} />
            )}
          </BarChart>
        </ChartContainer>
        {seriesLegend()}
      </>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {groupProperty
            ? tChart('groupedBy', { property: groupProperty.name })
            : tChart('allRows')}
        </p>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={tChart('chartType')}
                  title={tChart('chartType')}
                  className="border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors"
                />
              }
            >
              <TypeIcon className="size-3.5" aria-hidden="true" />
              <span>{t(`types.${VIEW_TYPE_KEYS[chartType]}`)}</span>
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52!">
              {CHART_VIEW_TYPES.map((type) => {
                const Icon = chartTypeIcon(type);

                return (
                  <DropdownMenuItem
                    key={type}
                    className="text-xs"
                    onClick={() => {
                      if (type !== chartType) {
                        onChangeType(type);
                      }
                    }}
                  >
                    {type === chartType ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <span className="size-4" aria-hidden="true" />
                    )}
                    <Icon className="size-3.5" aria-hidden="true" />
                    {t(`types.${VIEW_TYPE_KEYS[type]}`)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={tChart('settings')}
            title={tChart('settings')}
            onClick={() => setSettingsOpen(true)}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {chartBody()}

      <ChartSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        properties={properties}
        view={view}
        databaseTitle={databaseTitle}
        onChangeType={onChangeType}
        onUpdateView={onUpdateView}
      />
    </div>
  );
}
