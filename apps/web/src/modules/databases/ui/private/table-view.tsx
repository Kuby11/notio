import type { DatabaseProperty, DatabaseRow, DatabaseView, PropertyValue } from '@notio/contracts';
import { useTranslations } from 'next-intl';
import { PropertyCell } from './property-cell';
import { NewPropertyButton, PropertyMenu, type EditablePropertyType } from './property-menu';
import { Button } from '../../../../shared/ui/button';

export interface TablePropertyActions {
  /** Creates a property of the chosen type; the name comes from the type label. */
  add: (type: EditablePropertyType) => void;
  rename: (propertyId: string, name: string) => void;
  changeType: (propertyId: string, type: EditablePropertyType) => void;
  duplicate: (propertyId: string, name: string) => void;
  hide: (propertyId: string) => void;
  show: (propertyId: string) => void;
  remove: (propertyId: string) => void;
}

export interface TableViewProps {
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  view: DatabaseView;
  aggregations: Record<string, number | string | null>;
  hiddenProperties: DatabaseProperty[];
  propertyActions: TablePropertyActions;
  onCellChange: (row: DatabaseRow, propertyId: string, value: PropertyValue | null) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
}

export function TableView({
  properties,
  rows,
  view,
  aggregations,
  hiddenProperties,
  propertyActions,
  onCellChange,
  onAddRow,
  onDeleteRow,
}: TableViewProps) {
  const t = useTranslations('databases.table');
  const visibleProps =
    view.visiblePropertyIds && view.visiblePropertyIds.length > 0
      ? properties.filter((p) => view.visiblePropertyIds.includes(p.id))
      : properties;

  return (
    <div className="w-full overflow-x-auto border-t border-border">
      <table className="w-full border-collapse text-left text-sm">
        {/* Table Header */}
        <thead>
          <tr className="border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
            <th scope="col" className="w-8 px-2 py-2">
              #
            </th>
            {visibleProps.map((prop) => {
              const width = view.columnWidths?.[prop.id] ?? (prop.type === 'title' ? 240 : 160);
              return (
                <th
                  key={prop.id}
                  scope="col"
                  style={{ width: `${width}px`, minWidth: `${width}px` }}
                  className="border-border/50 border-r px-3 py-2 font-medium"
                >
                  <PropertyMenu
                    property={prop}
                    onRename={(name) => propertyActions.rename(prop.id, name)}
                    onChangeType={(type) => propertyActions.changeType(prop.id, type)}
                    onDuplicate={(name) => propertyActions.duplicate(prop.id, name)}
                    onHide={() => propertyActions.hide(prop.id)}
                    onDelete={() => propertyActions.remove(prop.id)}
                  />
                </th>
              );
            })}
            <th scope="col" className="w-10 px-2 py-2">
              <NewPropertyButton
                onAdd={propertyActions.add}
                hiddenProperties={hiddenProperties}
                onShow={propertyActions.show}
              />
            </th>
            <th scope="col" className="w-12 px-2 py-2 text-right">
              <span className="sr-only">{t('rowActions')}</span>
            </th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              className="group border-b border-border/40 hover:bg-muted/20 transition-colors"
            >
              <td className="px-2 py-2 text-xs text-muted-foreground/50 text-center font-mono">
                {idx + 1}
              </td>
              {visibleProps.map((prop) => {
                const val = prop.type === 'title' ? row.title : (row.properties[prop.id] ?? null);
                return (
                  <td key={prop.id} className="border-r border-border/40 p-1 align-middle">
                    <PropertyCell
                      property={prop}
                      value={val}
                      isTitle={prop.type === 'title'}
                      onChange={(newVal) => onCellChange(row, prop.id, newVal)}
                    />
                  </td>
                );
              })}
              <td className="px-2 py-2 text-right">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDeleteRow(row.id)}
                  className="text-destructive hover:bg-destructive/10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={t('deleteRow', { title: row.title })}
                  title={t('deleteRow', { title: row.title })}
                >
                  ✕
                </Button>
              </td>
            </tr>
          ))}

          {/* Add Row Button */}
          <tr>
            <td colSpan={visibleProps.length + 3} className="p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onAddRow}
                className="w-full justify-start text-xs text-muted-foreground hover:text-foreground h-8"
              >
                {t('newPage')}
              </Button>
            </td>
          </tr>
        </tbody>

        {/* Table Footer: Column Aggregations */}
        <tfoot>
          <tr className="border-t border-border bg-muted/20 text-xs text-muted-foreground font-mono">
            <td className="px-2 py-2">
              <span className="sr-only">{t('summary')}</span>
            </td>
            {visibleProps.map((prop) => {
              const aggVal = aggregations[prop.id];
              return (
                <td key={prop.id} className="border-r border-border/50 px-3 py-2 truncate">
                  {aggVal !== undefined && aggVal !== null ? (
                    <span className="font-medium text-foreground">
                      {prop.type === 'checkbox'
                        ? t('percentChecked', { value: String(aggVal) })
                        : String(aggVal)}
                    </span>
                  ) : null}
                </td>
              );
            })}
            <td></td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
