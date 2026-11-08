import { z } from 'zod';
import { HttpUrlSchema, IdSchema, IsoDateTimeSchema } from './ids';

/**
 * All supported property types in a Notion-like database.
 */
export const DATABASE_PROPERTY_TYPES = [
  'title',
  'text',
  'number',
  'select',
  'multi_select',
  'status',
  'date',
  'checkbox',
  'url',
  'email',
  'phone_number',
  'person',
  'files',
  'relation',
  'rollup',
  'formula',
  'created_time',
  'created_by',
  'last_edited_time',
  'last_edited_by',
] as const;

export type DatabasePropertyType = (typeof DATABASE_PROPERTY_TYPES)[number];
export const DatabasePropertyTypeSchema = z.enum(DATABASE_PROPERTY_TYPES);

/**
 * Standard Notion color palette for select tags and status badges.
 */
export const PROPERTY_COLOR_PRESETS = [
  'default',
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
] as const;

export type PropertyColorPreset = (typeof PROPERTY_COLOR_PRESETS)[number];
export const PropertyColorPresetSchema = z.enum(PROPERTY_COLOR_PRESETS);

/**
 * An option for Select or Multi-Select properties.
 */
export const SelectOptionSchema = z.strictObject({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  color: PropertyColorPresetSchema.default('default'),
});
export type SelectOption = z.infer<typeof SelectOptionSchema>;

/**
 * Notion Status property group: 'to_do', 'in_progress', 'complete'.
 */
export const STATUS_GROUPS = ['to_do', 'in_progress', 'complete'] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];
export const StatusGroupSchema = z.enum(STATUS_GROUPS);

export const StatusOptionSchema = z.strictObject({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  color: PropertyColorPresetSchema.default('default'),
  group: StatusGroupSchema,
});
export type StatusOption = z.infer<typeof StatusOptionSchema>;

/**
 * Number formatting presets.
 */
export const NUMBER_FORMATS = [
  'number',
  'number_with_commas',
  'percent',
  'dollar',
  'euro',
  'pound',
  'yen',
  'ruble',
] as const;
export type NumberFormat = (typeof NUMBER_FORMATS)[number];
export const NumberFormatSchema = z.enum(NUMBER_FORMATS);

/**
 * Rollup aggregation functions.
 */
export const ROLLUP_CALCULATIONS = [
  'count_all',
  'count_values',
  'count_unique_values',
  'count_empty',
  'count_not_empty',
  'percent_empty',
  'percent_not_empty',
  'sum',
  'average',
  'median',
  'min',
  'max',
  'range',
  'show_original',
] as const;
export type RollupCalculation = (typeof ROLLUP_CALCULATIONS)[number];
export const RollupCalculationSchema = z.enum(ROLLUP_CALCULATIONS);

/**
 * Property-specific configuration schemas.
 */
export const SelectConfigSchema = z.strictObject({
  options: z.array(SelectOptionSchema).default([]),
});
export type SelectConfig = z.infer<typeof SelectConfigSchema>;

export const StatusConfigSchema = z.strictObject({
  options: z.array(StatusOptionSchema).default([]),
});
export type StatusConfig = z.infer<typeof StatusConfigSchema>;

export const NumberConfigSchema = z.strictObject({
  format: NumberFormatSchema.default('number'),
});
export type NumberConfig = z.infer<typeof NumberConfigSchema>;

export const FormulaConfigSchema = z.strictObject({
  expression: z.string().max(2000),
});
export type FormulaConfig = z.infer<typeof FormulaConfigSchema>;

export const RelationConfigSchema = z.strictObject({
  targetDatabaseId: IdSchema,
  twoWay: z.boolean().default(false),
  targetPropertyId: z.string().optional(),
});
export type RelationConfig = z.infer<typeof RelationConfigSchema>;

export const RollupConfigSchema = z.strictObject({
  relationPropertyId: z.string().min(1),
  targetPropertyId: z.string().min(1),
  calculation: RollupCalculationSchema.default('count_all'),
});
export type RollupConfig = z.infer<typeof RollupConfigSchema>;

/**
 * A property definition inside a database schema.
 */
export const DatabasePropertySchema = z.strictObject({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  type: DatabasePropertyTypeSchema,
  description: z.string().max(1000).optional(),
  selectConfig: SelectConfigSchema.optional(),
  statusConfig: StatusConfigSchema.optional(),
  numberConfig: NumberConfigSchema.optional(),
  formulaConfig: FormulaConfigSchema.optional(),
  relationConfig: RelationConfigSchema.optional(),
  rollupConfig: RollupConfigSchema.optional(),
});
export type DatabaseProperty = z.infer<typeof DatabasePropertySchema>;

/**
 * Date property value structure.
 */
export const DatePropertyValueSchema = z.strictObject({
  start: z.string(),
  end: z.string().optional(),
  includeTime: z.boolean().optional(),
});
export type DatePropertyValue = z.infer<typeof DatePropertyValueSchema>;

/**
 * File attachment in database row.
 */
export const FilePropertyValueSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  url: HttpUrlSchema,
  sizeBytes: z.number().nonnegative().optional(),
});
export type FilePropertyValue = z.infer<typeof FilePropertyValueSchema>;

/**
 * Property values stored on each row (polymorphic by type).
 */
export const PropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()), // multi_select option IDs, person IDs, relation row IDs
  DatePropertyValueSchema,
  z.array(FilePropertyValueSchema),
]);
export type PropertyValue = z.infer<typeof PropertyValueSchema>;

/**
 * Database views.
 */
export const DATABASE_VIEW_TYPES = [
  'table',
  'board',
  'list',
  'gallery',
  'calendar',
  'timeline',
  'chart_horizontal',
  'chart_vertical',
  'chart_donut',
  'chart_line',
  'chart_number',
] as const;
export type DatabaseViewType = (typeof DATABASE_VIEW_TYPES)[number];
export const DatabaseViewTypeSchema = z.enum(DATABASE_VIEW_TYPES);

/**
 * Filter operators for each type category.
 */
export const FILTER_OPERATORS = [
  'equals',
  'does_not_equal',
  'contains',
  'does_not_contain',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
  'greater_than',
  'less_than',
  'greater_than_or_equal_to',
  'less_than_or_equal_to',
  'before',
  'after',
  'is_checked',
  'is_not_checked',
] as const;
export type FilterOperator = (typeof FILTER_OPERATORS)[number];
export const FilterOperatorSchema = z.enum(FILTER_OPERATORS);

export const PropertyFilterSchema = z.strictObject({
  propertyId: z.string().min(1),
  operator: FilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
});
export type PropertyFilter = z.infer<typeof PropertyFilterSchema>;

export type DatabaseFilter = PropertyFilter | { and: DatabaseFilter[] } | { or: DatabaseFilter[] };

export const DatabaseFilterSchema: z.ZodType<DatabaseFilter> = z.lazy(() =>
  z.union([
    PropertyFilterSchema,
    z.strictObject({ and: z.array(DatabaseFilterSchema).min(1) }),
    z.strictObject({ or: z.array(DatabaseFilterSchema).min(1) }),
  ]),
);

/**
 * Sort definition.
 */
export const DatabaseSortSchema = z.strictObject({
  propertyId: z.string().min(1),
  direction: z.enum(['ascending', 'descending']),
});
export type DatabaseSort = z.infer<typeof DatabaseSortSchema>;

/**
 * GroupBy definition (crucial for Kanban Board).
 */
export const DatabaseGroupBySchema = z.strictObject({
  propertyId: z.string().min(1),
  sortDirection: z.enum(['ascending', 'descending']).default('ascending'),
  hideEmpty: z.boolean().default(false),
});
export type DatabaseGroupBy = z.infer<typeof DatabaseGroupBySchema>;

/**
 * Column calculation / summary in table footer.
 */
export const CALCULATION_TYPES = [
  'count_all',
  'count_values',
  'count_unique_values',
  'count_empty',
  'count_not_empty',
  'percent_empty',
  'percent_not_empty',
  'sum',
  'average',
  'median',
  'min',
  'max',
  'range',
  'checked',
  'unchecked',
  'percent_checked',
  'percent_unchecked',
] as const;
export type CalculationType = (typeof CALCULATION_TYPES)[number];
export const CalculationTypeSchema = z.enum(CALCULATION_TYPES);

export const DatabaseAggregationSchema = z.strictObject({
  propertyId: z.string().min(1),
  calculation: CalculationTypeSchema,
});
export type DatabaseAggregation = z.infer<typeof DatabaseAggregationSchema>;

/** Order of slices/bars/lines in a chart view. */
export const CHART_SORT_MODES = ['count_desc', 'count_asc', 'label_asc', 'label_desc'] as const;
export type ChartSortMode = (typeof CHART_SORT_MODES)[number];
export const ChartSortModeSchema = z.enum(CHART_SORT_MODES);

/**
 * How chart values are calculated. Numeric aggregations are only meaningful
 * when valuePropertyId points at a numeric property.
 */
export const CHART_AGGREGATIONS = ['count_all', 'sum', 'average', 'min', 'max', 'median'] as const;
export type ChartAggregation = (typeof CHART_AGGREGATIONS)[number];
export const ChartAggregationSchema = z.enum(CHART_AGGREGATIONS);

/** Base color palettes available in chart settings. */
export const CHART_COLOR_MODES = ['auto', 'green', 'blue', 'purple', 'orange', 'red'] as const;
export type ChartColorMode = (typeof CHART_COLOR_MODES)[number];
export const ChartColorModeSchema = z.enum(CHART_COLOR_MODES);

/** Y-axis range: automatic or a fixed min/max. */
export const ChartRangeSchema = z.strictObject({
  mode: z.enum(['auto', 'custom']).default('auto'),
  min: z.number().finite().nullable().optional(),
  max: z.number().finite().nullable().optional(),
});
export type ChartRange = z.infer<typeof ChartRangeSchema>;

/**
 * Chart-only settings. Kept separate from groupBy, which board views also use:
 * null groupPropertyId explicitly means a single "all rows" chart, while a
 * missing value falls back to groupBy or the first status/select property.
 */
export const ChartConfigSchema = z.strictObject({
  sort: ChartSortModeSchema.default('count_desc'),
  groupPropertyId: z.string().min(1).nullable().optional(),
  /** Optional second dimension used for stacked bars or multiple lines. */
  seriesPropertyId: z.string().min(1).nullable().optional(),
  /** Property aggregated on the Y axis; null means count rows. */
  valuePropertyId: z.string().min(1).nullable().optional(),
  aggregation: ChartAggregationSchema.default('count_all'),
  range: ChartRangeSchema.optional(),
  referenceLines: z.array(z.number().finite()).max(5).default([]),
  color: ChartColorModeSchema.default('auto'),
});
export type ChartConfig = z.infer<typeof ChartConfigSchema>;

/**
 * Database View configuration.
 */
export const DatabaseViewSchema = z.strictObject({
  id: IdSchema,
  databaseId: IdSchema,
  name: z.string().min(1).max(255),
  type: DatabaseViewTypeSchema,
  filter: DatabaseFilterSchema.optional(),
  sorts: z.array(DatabaseSortSchema).default([]),
  groupBy: DatabaseGroupBySchema.optional(),
  chart: ChartConfigSchema.optional(),
  visiblePropertyIds: z.array(z.string()).default([]),
  columnWidths: z.record(z.string(), z.number().positive()).optional(),
  aggregations: z.array(DatabaseAggregationSchema).optional(),
});
export type DatabaseView = z.infer<typeof DatabaseViewSchema>;

/**
 * The Database entity schema.
 */
export const DatabaseSchema = z.strictObject({
  id: IdSchema,
  workspaceId: IdSchema,
  parentId: IdSchema.nullable().default(null),
  title: z.string().max(500).default('Untitled Database'),
  description: z.string().max(2000).optional(),
  icon: z.string().min(1).max(64).optional(),
  coverFileId: IdSchema.optional(),
  isInline: z.boolean().default(false),
  properties: z.array(DatabasePropertySchema),
  defaultViewId: IdSchema.optional(),
  isTrashed: z.boolean().default(false),
  createdBy: IdSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Database = z.infer<typeof DatabaseSchema>;

/**
 * The Database Row entity (in Notion, every row is a Page in a database collection).
 */
export const DatabaseRowSchema = z.strictObject({
  id: IdSchema,
  databaseId: IdSchema,
  workspaceId: IdSchema,
  title: z.string().max(500).default(''),
  properties: z.record(z.string(), PropertyValueSchema.nullable()).default({}),
  isTrashed: z.boolean().default(false),
  createdBy: IdSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type DatabaseRow = z.infer<typeof DatabaseRowSchema>;

/**
 * Inputs for Database operations.
 */
export const CreateDatabaseInputSchema = z.strictObject({
  workspaceId: IdSchema,
  parentId: IdSchema.nullable().default(null),
  title: z.string().max(500).default('Untitled Database'),
  isInline: z.boolean().default(false),
  properties: z.array(DatabasePropertySchema).optional(),
});
export type CreateDatabaseInput = z.infer<typeof CreateDatabaseInputSchema>;

export const UpdateDatabaseInputSchema = z
  .strictObject({
    title: z.string().max(500).optional(),
    description: z.string().max(2000).nullable().optional(),
    icon: z.string().max(64).nullable().optional(),
    coverFileId: IdSchema.nullable().optional(),
    properties: z.array(DatabasePropertySchema).optional(),
    isTrashed: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable field is required',
  });
export type UpdateDatabaseInput = z.infer<typeof UpdateDatabaseInputSchema>;

export const CreateRowInputSchema = z.strictObject({
  databaseId: IdSchema,
  title: z.string().max(500).default(''),
  properties: z.record(z.string(), PropertyValueSchema.nullable()).optional(),
});
export type CreateRowInput = z.infer<typeof CreateRowInputSchema>;

export const UpdateRowInputSchema = z
  .strictObject({
    title: z.string().max(500).optional(),
    properties: z.record(z.string(), PropertyValueSchema.nullable()).optional(),
    isTrashed: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable field is required',
  });
export type UpdateRowInput = z.infer<typeof UpdateRowInputSchema>;

export const CreateViewInputSchema = z.strictObject({
  databaseId: IdSchema,
  name: z.string().min(1).max(255),
  type: DatabaseViewTypeSchema,
  filter: DatabaseFilterSchema.optional(),
  sorts: z.array(DatabaseSortSchema).optional(),
  groupBy: DatabaseGroupBySchema.optional(),
  chart: ChartConfigSchema.optional(),
  visiblePropertyIds: z.array(z.string()).optional(),
});
export type CreateViewInput = z.infer<typeof CreateViewInputSchema>;

export const UpdateViewInputSchema = z
  .strictObject({
    name: z.string().min(1).max(255).optional(),
    type: DatabaseViewTypeSchema.optional(),
    filter: DatabaseFilterSchema.nullable().optional(),
    sorts: z.array(DatabaseSortSchema).optional(),
    groupBy: DatabaseGroupBySchema.nullable().optional(),
    chart: ChartConfigSchema.nullable().optional(),
    visiblePropertyIds: z.array(z.string()).optional(),
    columnWidths: z.record(z.string(), z.number().positive()).optional(),
    aggregations: z.array(DatabaseAggregationSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable field is required',
  });
export type UpdateViewInput = z.infer<typeof UpdateViewInputSchema>;
