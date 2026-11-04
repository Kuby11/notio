'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';
import { cn } from 'cn';

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    color?: string;
  }
>;

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null);

function useChart(): { config: ChartConfig } {
  const context = React.useContext(ChartContext);

  if (context === null) {
    throw new Error('useChart must be used within a ChartContainer');
  }

  return context;
}

/**
 * The theme colours become custom properties on the container itself instead
 * of a generated `<style>` block. Markup-injected CSS was unnecessary here:
 * the same variables are readable by every descendant, and no string built
 * from configuration ever reaches the DOM as stylesheet text.
 */
function chartColorStyles(config: ChartConfig): React.CSSProperties {
  const styles: Record<string, string> = {};

  for (const [key, item] of Object.entries(config)) {
    if (item.color) {
      styles[`--color-${key}`] = item.color;
    }
  }

  return styles as React.CSSProperties;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ReactElement;
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replaceAll(':', '')}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        style={{ ...chartColorStyles(config), ...props.style }}
        className={cn(
          'flex aspect-video justify-center text-xs',
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className,
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

interface TooltipItem {
  name?: React.ReactNode;
  dataKey?: string | number;
  value?: unknown;
  color?: string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  hideLabel = false,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: React.ReactNode;
  className?: string;
  hideLabel?: boolean;
}) {
  const { config } = useChart();

  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'border-border/50 bg-background grid min-w-32 gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl',
        className,
      )}
    >
      {!hideLabel && label ? <div className="font-medium">{label}</div> : null}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = String(item.dataKey ?? item.name ?? index);
          const itemConfig = config[key] ?? config[String(item.name ?? '')] ?? {};

          return (
            <div key={key} className="flex w-full items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item.color ?? 'var(--chart-1)' }}
              />
              <span className="text-muted-foreground">{itemConfig.label ?? item.name}</span>
              <span className="text-foreground ml-auto font-mono font-medium tabular-nums">
                {String(item.value ?? '')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ChartLegend = RechartsPrimitive.Legend;

export function ChartLegendContent({
  payload,
  className,
}: {
  payload?: { value?: React.ReactNode; color?: string; dataKey?: string | number }[];
  className?: string;
}) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-3 pt-2', className)}>
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value ?? '');
        const itemConfig = config[key] ?? {};

        return (
          <span key={key} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color ?? 'var(--chart-1)' }}
            />
            <span className="text-muted-foreground">{itemConfig.label ?? item.value}</span>
          </span>
        );
      })}
    </div>
  );
}
