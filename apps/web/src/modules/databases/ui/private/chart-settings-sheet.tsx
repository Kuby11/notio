'use client';

import {
  CHART_AGGREGATIONS,
  CHART_COLOR_MODES,
  type ChartAggregation,
  type ChartColorMode,
  type ChartConfig,
  type ChartSortMode,
  type DatabaseProperty,
  type DatabaseView,
  type DatabaseViewType,
  type FilterOperator,
  type PropertyFilter,
  type UpdateViewInput,
} from '@notio/contracts';
import {
  ArrowDownUp,
  ChevronRight,
  Database,
  Hash,
  Info,
  Link2,
  ListFilter,
  Paintbrush,
  Plus,
  Rows3,
  Sigma,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Input } from '@/shared/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/shared/ui/sheet';
import { cn } from 'cn';
import { chartGroupProperty } from '../../utils/chart-data';
import { CHART_VIEW_TYPES, isChartViewType, VIEW_TYPE_KEYS } from '../../utils/view-types';
import { chartTypeIcon } from './chart-type-icon';

const SORT_KEYS: Record<ChartSortMode, string> = {
  count_desc: 'sortCountDesc',
  count_asc: 'sortCountAsc',
  label_asc: 'sortLabelAsc',
  label_desc: 'sortLabelDesc',
};

const AGGREGATION_KEYS: Record<ChartAggregation, string> = {
  count_all: 'count',
  sum: 'sum',
  average: 'average',
  min: 'min',
  max: 'max',
  median: 'median',
};

const COLOR_KEYS: Record<ChartColorMode, string> = {
  auto: 'colorAuto',
  green: 'colorGreen',
  blue: 'colorBlue',
  purple: 'colorPurple',
  orange: 'colorOrange',
  red: 'colorRed',
};

const OPERATOR_KEYS: Record<FilterOperator, string> = {
  equals: 'equals',
  does_not_equal: 'doesNotEqual',
  contains: 'contains',
  does_not_contain: 'doesNotContain',
  starts_with: 'startsWith',
  ends_with: 'endsWith',
  is_empty: 'isEmpty',
  is_not_empty: 'isNotEmpty',
  greater_than: 'greaterThan',
  less_than: 'lessThan',
  greater_than_or_equal_to: 'greaterThanOrEqual',
  less_than_or_equal_to: 'lessThanOrEqual',
  before: 'before',
  after: 'after',
  is_checked: 'isChecked',
  is_not_checked: 'isNotChecked',
};

const TEXT_OPERATORS: FilterOperator[] = [
  'equals',
  'does_not_equal',
  'contains',
  'does_not_contain',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
];

const NUMBER_OPERATORS: FilterOperator[] = [
  'equals',
  'does_not_equal',
  'greater_than',
  'less_than',
  'greater_than_or_equal_to',
  'less_than_or_equal_to',
  'is_empty',
  'is_not_empty',
];

const SELECT_OPERATORS: FilterOperator[] = ['equals', 'does_not_equal', 'is_empty', 'is_not_empty'];
const DATE_OPERATORS: FilterOperator[] = ['equals', 'before', 'after', 'is_empty', 'is_not_empty'];
const CHECKBOX_OPERATORS: FilterOperator[] = ['is_checked', 'is_not_checked'];

const SETTING_PROPS_EXCLUDED = new Set([
  'title',
  'multi_select',
  'files',
  'relation',
  'rollup',
  'formula',
  'created_by',
  'last_edited_by',
]);

interface ChartSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: DatabaseProperty[];
  view: DatabaseView;
  databaseTitle: string;
  onChangeType: (type: DatabaseViewType) => void;
  onUpdateView: (input: UpdateViewInput) => void;
}

interface SettingRowProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

function SettingRow({ icon: Icon, label, value }: SettingRowProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 text-sm">
      <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <span className="text-muted-foreground max-w-[50%] truncate text-right text-xs">{value}</span>
    </div>
  );
}

interface SettingMenuProps {
  icon: LucideIcon;
  label: string;
  value: string;
  children: ReactNode;
}

function SettingMenu({ icon: Icon, label, value, children }: SettingMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="hover:bg-muted/60 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors"
          />
        }
      >
        <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <span className="text-muted-foreground max-w-[50%] truncate text-right text-xs">
          {value}
        </span>
        <ChevronRight className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56!">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-muted-foreground px-2 text-xs font-medium">{title}</h3>
      {children}
    </section>
  );
}

function singleFilter(filter: DatabaseView['filter']): PropertyFilter | null {
  if (!filter || !('propertyId' in filter)) {
    return null;
  }

  return filter;
}

function defaultFilterOperator(property: DatabaseProperty): FilterOperator {
  if (property.type === 'checkbox') {
    return 'is_checked';
  }

  if (property.type === 'status' || property.type === 'select') {
    return 'is_not_empty';
  }

  return 'is_not_empty';
}

function filterOperators(property: DatabaseProperty | undefined): FilterOperator[] {
  if (!property) {
    return TEXT_OPERATORS;
  }

  if (property.type === 'checkbox') {
    return CHECKBOX_OPERATORS;
  }

  if (property.type === 'number' || property.type === 'rollup' || property.type === 'formula') {
    return NUMBER_OPERATORS;
  }

  if (
    property.type === 'date' ||
    property.type === 'created_time' ||
    property.type === 'last_edited_time'
  ) {
    return DATE_OPERATORS;
  }

  if (property.type === 'status' || property.type === 'select') {
    return SELECT_OPERATORS;
  }

  return TEXT_OPERATORS;
}

function filterNeedsValue(operator: FilterOperator): boolean {
  return !['is_empty', 'is_not_empty', 'is_checked', 'is_not_checked'].includes(operator);
}

function filterOptions(property: DatabaseProperty | undefined) {
  if (!property) {
    return [];
  }

  return property.statusConfig?.options ?? property.selectConfig?.options ?? [];
}

interface FilterEditorProps {
  filter: PropertyFilter | null;
  hasCompoundFilter: boolean;
  properties: DatabaseProperty[];
  onUpdate: (filter: PropertyFilter | null) => void;
}

function FilterEditor({ filter, hasCompoundFilter, properties, onUpdate }: FilterEditorProps) {
  const t = useTranslations('databases.chart');
  const property = filter
    ? properties.find((candidate) => candidate.id === filter.propertyId)
    : undefined;
  const operators = filterOperators(property);
  const options = filterOptions(property);
  const selectedOption = options.find((option) => option.id === filter?.value);
  const needsValue = filter ? filterNeedsValue(filter.operator) : false;

  if (hasCompoundFilter) {
    return (
      <div className="space-y-2 rounded-md border p-2">
        <p className="text-muted-foreground text-xs">{t('multipleFilters')}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => onUpdate(null)}>
          {t('clearFilter')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-md border p-2">
      <SettingMenu
        icon={Rows3}
        label={t('filterProperty')}
        value={property?.name ?? t('chooseProperty')}
      >
        {properties.map((candidate) => (
          <DropdownMenuItem
            key={candidate.id}
            className="text-xs"
            onClick={() =>
              onUpdate({
                propertyId: candidate.id,
                operator: defaultFilterOperator(candidate),
              })
            }
          >
            {candidate.name}
          </DropdownMenuItem>
        ))}
      </SettingMenu>

      {filter && property ? (
        <>
          <SettingMenu
            icon={ListFilter}
            label={t('condition')}
            value={t(`operators.${OPERATOR_KEYS[filter.operator]}`)}
          >
            {operators.map((operator) => (
              <DropdownMenuItem
                key={operator}
                className="text-xs"
                onClick={() =>
                  onUpdate({
                    ...filter,
                    operator,
                    ...(filterNeedsValue(operator) ? {} : { value: undefined }),
                  })
                }
              >
                {t(`operators.${OPERATOR_KEYS[operator]}`)}
              </DropdownMenuItem>
            ))}
          </SettingMenu>

          {needsValue && options.length > 0 ? (
            <SettingMenu
              icon={Hash}
              label={t('value')}
              value={selectedOption?.name ?? t('chooseValue')}
            >
              {options.map((option) => (
                <DropdownMenuItem
                  key={option.id}
                  className="text-xs"
                  onClick={() => onUpdate({ ...filter, value: option.id })}
                >
                  {option.name}
                </DropdownMenuItem>
              ))}
            </SettingMenu>
          ) : needsValue ? (
            <div className="px-2 py-1">
              <Input
                aria-label={t('value')}
                type={property.type === 'number' ? 'number' : 'text'}
                value={
                  filter.value === null || filter.value === undefined ? '' : String(filter.value)
                }
                onChange={(event) => {
                  const raw = event.target.value;

                  if (property.type === 'number') {
                    if (raw !== '' && !Number.isFinite(Number(raw))) {
                      return;
                    }

                    onUpdate({ ...filter, value: raw === '' ? null : Number(raw) });
                    return;
                  }

                  onUpdate({ ...filter, value: raw === '' ? null : raw });
                }}
                className="h-8"
              />
            </div>
          ) : null}

          <Button type="button" variant="ghost" size="sm" onClick={() => onUpdate(null)}>
            {t('clearFilter')}
          </Button>
        </>
      ) : null}
    </div>
  );
}

/**
 * View settings for a chart view.
 *
 * X/Y controls are intentionally limited to the cartesian chart variants;
 * donut and number charts only expose data settings. The panel deliberately
 * does not include layout, omit-zero-values, or "save chart as" rows.
 */
export function ChartSettingsSheet({
  open,
  onOpenChange,
  properties,
  view,
  databaseTitle,
  onChangeType,
  onUpdateView,
}: ChartSettingsSheetProps) {
  const t = useTranslations('databases.chart');
  const tViews = useTranslations('databases.views');
  const [copied, setCopied] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(view.name);
  const chartType = isChartViewType(view.type) ? view.type : 'chart_vertical';
  const isCartesian =
    chartType === 'chart_horizontal' ||
    chartType === 'chart_vertical' ||
    chartType === 'chart_line';
  const groupProperty = chartGroupProperty(properties, view);
  const ChartIcon = chartTypeIcon(chartType);
  const sort = view.chart?.sort ?? 'count_desc';
  const aggregation = view.chart?.aggregation ?? 'count_all';
  const color = view.chart?.color ?? 'auto';
  const referenceLines = view.chart?.referenceLines ?? [];
  const range = view.chart?.range;
  const valueProperty = properties.find((property) => property.id === view.chart?.valuePropertyId);
  const seriesProperty = properties.find(
    (property) => property.id === view.chart?.seriesPropertyId,
  );
  const single = singleFilter(view.filter);
  const groupableProperties = properties.filter(
    (property) => !SETTING_PROPS_EXCLUDED.has(property.type),
  );
  const numericProperties = properties.filter((property) => property.type === 'number');
  const seriesProperties = groupableProperties.filter(
    (property) => property.id !== groupProperty?.id,
  );

  useEffect(() => {
    setNameDraft(view.name);
  }, [view.id, view.name]);

  function updateChart(patch: Partial<ChartConfig>) {
    onUpdateView({
      chart: {
        sort,
        aggregation,
        color,
        referenceLines,
        ...(view.chart?.groupPropertyId !== undefined
          ? { groupPropertyId: view.chart.groupPropertyId }
          : {}),
        ...(view.chart?.seriesPropertyId !== undefined
          ? { seriesPropertyId: view.chart.seriesPropertyId }
          : {}),
        ...(view.chart?.valuePropertyId !== undefined
          ? { valuePropertyId: view.chart.valuePropertyId }
          : {}),
        ...(view.chart?.range !== undefined ? { range: view.chart.range } : {}),
        ...patch,
      },
    });
  }

  function commitName() {
    const next = nameDraft.trim();

    if (!next) {
      setNameDraft(view.name);
      return;
    }

    if (next !== view.name) {
      onUpdateView({ name: next });
    }
  }

  function selectValueProperty(property: DatabaseProperty | null) {
    if (!property) {
      updateChart({ valuePropertyId: null, aggregation: 'count_all' });
      return;
    }

    updateChart({
      valuePropertyId: property.id,
      aggregation: aggregation === 'count_all' ? 'sum' : aggregation,
    });
  }

  function updateRange(key: 'min' | 'max', raw: string) {
    const value = raw === '' ? null : Number(raw);

    if (value !== null && !Number.isFinite(value)) {
      return;
    }

    updateChart({
      range: {
        mode: 'custom',
        min: range?.min ?? null,
        max: range?.max ?? null,
        [key]: value,
      },
    });
  }

  function updateReferenceLine(index: number, raw: string) {
    const value = Number(raw);

    if (!Number.isFinite(value)) {
      return;
    }

    const next = [...referenceLines];
    next[index] = value;
    updateChart({ referenceLines: next });
  }

  async function copyLink() {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view.id);

    try {
      await navigator.clipboard.writeText(url.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const groupMenu = (
    <>
      <DropdownMenuItem className="text-xs" onClick={() => updateChart({ groupPropertyId: null })}>
        {t('none')}
      </DropdownMenuItem>
      {groupableProperties.map((property) => (
        <DropdownMenuItem
          key={property.id}
          className="text-xs"
          onClick={() => updateChart({ groupPropertyId: property.id })}
        >
          {property.name}
        </DropdownMenuItem>
      ))}
    </>
  );

  const seriesMenu = (
    <>
      <DropdownMenuItem className="text-xs" onClick={() => updateChart({ seriesPropertyId: null })}>
        {t('none')}
      </DropdownMenuItem>
      {seriesProperties.map((property) => (
        <DropdownMenuItem
          key={property.id}
          className="text-xs"
          onClick={() => updateChart({ seriesPropertyId: property.id })}
        >
          {property.name}
        </DropdownMenuItem>
      ))}
    </>
  );

  const valueMenu = (
    <>
      <DropdownMenuItem className="text-xs" onClick={() => selectValueProperty(null)}>
        {t('count')}
      </DropdownMenuItem>
      {numericProperties.map((property) => (
        <DropdownMenuItem
          key={property.id}
          className="text-xs"
          onClick={() => selectValueProperty(property)}
        >
          {property.name}
        </DropdownMenuItem>
      ))}
    </>
  );

  const aggregationMenu = (
    <>
      {CHART_AGGREGATIONS.map((mode) => (
        <DropdownMenuItem
          key={mode}
          className="text-xs"
          onClick={() =>
            updateChart({
              aggregation: mode,
              ...(mode === 'count_all' ? { valuePropertyId: null } : {}),
            })
          }
        >
          {t(AGGREGATION_KEYS[mode])}
        </DropdownMenuItem>
      ))}
    </>
  );

  const sortMenu = (
    <>
      {(Object.keys(SORT_KEYS) as ChartSortMode[]).map((mode) => (
        <DropdownMenuItem
          key={mode}
          className="text-xs"
          onClick={() => updateChart({ sort: mode })}
        >
          {t(SORT_KEYS[mode])}
        </DropdownMenuItem>
      ))}
    </>
  );

  const colorMenu = (
    <>
      {CHART_COLOR_MODES.map((mode) => (
        <DropdownMenuItem
          key={mode}
          className="text-xs"
          onClick={() => updateChart({ color: mode })}
        >
          {t(COLOR_KEYS[mode])}
        </DropdownMenuItem>
      ))}
    </>
  );

  const rangeMenu = (
    <>
      <DropdownMenuItem
        className="text-xs"
        onClick={() => updateChart({ range: { mode: 'auto' } })}
      >
        {t('auto')}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-xs"
        onClick={() =>
          updateChart({
            range: {
              mode: 'custom',
              min: range?.min ?? 0,
              max: range?.max ?? null,
            },
          })
        }
      >
        {t('custom')}
      </DropdownMenuItem>
    </>
  );

  const referenceMenu = (
    <>
      <DropdownMenuItem className="text-xs" onClick={() => updateChart({ referenceLines: [] })}>
        {t('none')}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="text-xs"
        disabled={referenceLines.length >= 5}
        onClick={() => updateChart({ referenceLines: [...referenceLines, 0] })}
      >
        <Plus className="size-3.5" aria-hidden="true" />
        {t('addReferenceLine')}
      </DropdownMenuItem>
    </>
  );

  const valueLabel =
    valueProperty && aggregation !== 'count_all'
      ? `${t(AGGREGATION_KEYS[aggregation])} · ${valueProperty.name}`
      : t('count');
  const rangeValue = range?.mode === 'custom' ? t('custom') : t('auto');
  const referenceValue =
    referenceLines.length === 0
      ? t('zeroLines')
      : t('linesCount', { count: referenceLines.length });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>{t('viewSettings')}</SheetTitle>
          <SheetDescription className="sr-only">{t('settingsDescription')}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <div className="bg-muted/40 flex items-center gap-2 rounded-lg px-2.5 py-2">
            <span className="bg-background text-muted-foreground flex size-7 items-center justify-center rounded-md border">
              <ChartIcon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <Input
                aria-label={t('chartName')}
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={commitName}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                  if (event.key === 'Escape') {
                    setNameDraft(view.name);
                    event.currentTarget.blur();
                  }
                }}
                className="h-7 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
              />
              <p className="text-muted-foreground text-xs">{t('chart')}</p>
            </div>
            <Info className="text-muted-foreground size-4" aria-hidden="true" />
          </div>

          <Section title={t('chartType')}>
            <div className="grid grid-cols-5 gap-1.5">
              {CHART_VIEW_TYPES.map((type) => {
                const Icon = chartTypeIcon(type);
                const selected = type === chartType;

                return (
                  <Button
                    key={type}
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={tViews(`types.${VIEW_TYPE_KEYS[type]}`)}
                    title={tViews(`types.${VIEW_TYPE_KEYS[type]}`)}
                    aria-pressed={selected}
                    className={cn(
                      'h-10 w-full',
                      selected &&
                        'border-primary/50 bg-primary/10 text-primary hover:bg-primary/15',
                    )}
                    onClick={() => {
                      if (!selected) {
                        onChangeType(type);
                      }
                    }}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </Button>
                );
              })}
            </div>
          </Section>

          {isCartesian ? (
            <>
              <Section title={t('xAxis')}>
                <SettingMenu
                  icon={Rows3}
                  label={t('whatToShow')}
                  value={groupProperty?.name ?? t('none')}
                >
                  {groupMenu}
                </SettingMenu>
                <SettingMenu icon={ArrowDownUp} label={t('sortBy')} value={t(SORT_KEYS[sort])}>
                  {sortMenu}
                </SettingMenu>
              </Section>

              <Section title={t('yAxis')}>
                <SettingMenu icon={Hash} label={t('whatToShow')} value={valueLabel}>
                  {valueMenu}
                </SettingMenu>
                {valueProperty ? (
                  <SettingMenu
                    icon={Sigma}
                    label={t('aggregation')}
                    value={t(AGGREGATION_KEYS[aggregation])}
                  >
                    {aggregationMenu}
                  </SettingMenu>
                ) : null}
                <SettingMenu
                  icon={Rows3}
                  label={t('groupBy')}
                  value={seriesProperty?.name ?? t('none')}
                >
                  {seriesMenu}
                </SettingMenu>
                <SettingMenu icon={ArrowDownUp} label={t('range')} value={rangeValue}>
                  {rangeMenu}
                </SettingMenu>
                {range?.mode === 'custom' ? (
                  <div className="flex items-center gap-2 px-2 py-1">
                    <Input
                      aria-label={t('rangeMin')}
                      type="number"
                      value={range.min ?? ''}
                      onChange={(event) => updateRange('min', event.target.value)}
                      className="h-8"
                    />
                    <span className="text-muted-foreground text-xs">—</span>
                    <Input
                      aria-label={t('rangeMax')}
                      type="number"
                      value={range.max ?? ''}
                      onChange={(event) => updateRange('max', event.target.value)}
                      className="h-8"
                    />
                  </div>
                ) : null}
                <SettingMenu icon={ListFilter} label={t('referenceLine')} value={referenceValue}>
                  {referenceMenu}
                </SettingMenu>
                {referenceLines.map((line, index) => (
                  <div key={`reference-${index}`} className="flex items-center gap-2 px-2 py-1">
                    <Input
                      aria-label={t('referenceLineValue')}
                      type="number"
                      value={line}
                      onChange={(event) => updateReferenceLine(index, event.target.value)}
                      className="h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t('removeReferenceLine')}
                      onClick={() =>
                        updateChart({
                          referenceLines: referenceLines.filter(
                            (_, lineIndex) => lineIndex !== index,
                          ),
                        })
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </Section>

              <Section title={t('style')}>
                <SettingMenu icon={Paintbrush} label={t('color')} value={t(COLOR_KEYS[color])}>
                  {colorMenu}
                </SettingMenu>
              </Section>
            </>
          ) : chartType === 'chart_donut' ? (
            <Section title={t('data')}>
              <SettingMenu
                icon={Rows3}
                label={t('groupBy')}
                value={groupProperty?.name ?? t('none')}
              >
                {groupMenu}
              </SettingMenu>
              <SettingMenu icon={ArrowDownUp} label={t('sortBy')} value={t(SORT_KEYS[sort])}>
                {sortMenu}
              </SettingMenu>
              <SettingMenu icon={Hash} label={t('whatToShow')} value={valueLabel}>
                {valueMenu}
              </SettingMenu>
              {valueProperty ? (
                <SettingMenu
                  icon={Sigma}
                  label={t('aggregation')}
                  value={t(AGGREGATION_KEYS[aggregation])}
                >
                  {aggregationMenu}
                </SettingMenu>
              ) : null}
            </Section>
          ) : (
            <Section title={t('data')}>
              <SettingMenu icon={Hash} label={t('whatToShow')} value={valueLabel}>
                {valueMenu}
              </SettingMenu>
              {valueProperty ? (
                <SettingMenu
                  icon={Sigma}
                  label={t('aggregation')}
                  value={t(AGGREGATION_KEYS[aggregation])}
                >
                  {aggregationMenu}
                </SettingMenu>
              ) : null}
            </Section>
          )}

          <Section title={t('source')}>
            <SettingRow icon={Database} label={t('source')} value={databaseTitle} />
            <button
              type="button"
              className="hover:bg-muted/60 flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors"
              onClick={() => setFilterOpen((current) => !current)}
            >
              <ListFilter className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 text-left">{t('filter')}</span>
              <span className="text-muted-foreground text-xs">
                {!view.filter ? t('noFilters') : single ? t('oneFilter') : t('filtersActive')}
              </span>
              <ChevronRight
                className={cn(
                  'text-muted-foreground size-3.5 shrink-0 transition-transform',
                  filterOpen && 'rotate-90',
                )}
                aria-hidden="true"
              />
            </button>
            {filterOpen ? (
              <FilterEditor
                filter={single}
                hasCompoundFilter={Boolean(view.filter && !single)}
                properties={properties}
                onUpdate={(next) => onUpdateView({ filter: next })}
              />
            ) : null}
          </Section>

          <div className="border-t pt-3">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground w-full justify-start gap-2 px-2"
              onClick={() => {
                void copyLink();
              }}
            >
              <Link2 className="size-4" aria-hidden="true" />
              {copied ? t('copied') : t('copyLink')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
