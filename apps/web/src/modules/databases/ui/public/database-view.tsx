'use client';

import { useTranslations } from 'next-intl';
import { useDatabases } from '../../hooks/use-databases';
import { BoardView } from '../private/board-view';
import { CalendarView } from '../private/calendar-view';
import { ChartView } from '../private/chart-view';
import { GalleryView } from '../private/gallery-view';
import { ListView } from '../private/list-view';
import { TableView, type TablePropertyActions } from '../private/table-view';
import { ViewTabs } from '../private/view-tabs';
import { isChartViewType } from '../../utils/view-types';
import { cn } from 'cn';

export interface DatabaseViewProps {
  databaseId: string;
  /** View from the sidebar link (`?view=…`); missing means the first view. */
  initialViewId?: string;
  className?: string;
}

export function DatabaseView({ databaseId, initialViewId, className }: DatabaseViewProps) {
  const t = useTranslations('databases.property');
  const {
    database,
    rows,
    views,
    activeView,
    groups,
    aggregations,
    isLoading,
    isError,
    setActiveViewId,
    createRow,
    deleteRow,
    createView,
    updateView,
    duplicateView,
    deleteView,
    updateCell,
    moveCard,
    addProperty,
    updateProperty,
    deleteProperty,
    duplicateProperty,
    hideProperty,
    showProperty,
  } = useDatabases(databaseId, initialViewId);

  if (isLoading && !database) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground animate-pulse">
        Loading database...
      </div>
    );
  }

  if (isError || !database) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-destructive">
        Failed to load database.
      </div>
    );
  }

  const properties = database.properties;
  // An empty visiblePropertyIds means every property is shown: nothing is hidden.
  const hiddenProperties =
    activeView && activeView.visiblePropertyIds.length > 0
      ? properties.filter((property) => !activeView.visiblePropertyIds.includes(property.id))
      : [];

  const propertyActions: TablePropertyActions = {
    add: (type) => {
      void addProperty({ name: t(`types.${type}`), type });
    },
    rename: (propertyId, name) => {
      void updateProperty(propertyId, { name });
    },
    changeType: (propertyId, type) => {
      void updateProperty(propertyId, { type });
    },
    duplicate: (propertyId, name) => {
      void duplicateProperty(propertyId, name);
    },
    hide: (propertyId) => {
      void hideProperty(propertyId);
    },
    show: (propertyId) => {
      void showProperty(propertyId);
    },
    remove: (propertyId) => {
      void deleteProperty(propertyId);
    },
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-border bg-card shadow-xs overflow-hidden',
        className,
      )}
    >
      {/* Database Title Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/10">
        <div className="flex items-center gap-2">
          {database.icon && <span className="text-xl">{database.icon}</span>}
          <h2 className="text-lg font-bold tracking-tight text-foreground">{database.title}</h2>
        </div>
      </div>

      {/* Views Navigation */}
      <ViewTabs
        views={views}
        activeViewId={activeView?.id ?? null}
        onSelectView={setActiveViewId}
        onAddView={(type, name) => createView({ name, type })}
        onRenameView={(id, name) => updateView({ id, input: { name } })}
        onDuplicateView={(view, name) => {
          void duplicateView(view, name);
        }}
        onDeleteView={(id) => {
          void deleteView(id);
        }}
        onAddRow={() => createRow()}
      />

      {/* Active View Content */}
      <div className="flex-1">
        {activeView?.type === 'board' ? (
          <BoardView
            properties={properties}
            groups={groups}
            view={activeView}
            onCardMove={moveCard}
            onAddCard={(targetGroupId) => {
              if (activeView.groupBy) {
                createRow('New card', {
                  [activeView.groupBy.propertyId]:
                    targetGroupId === '__empty__' ? null : targetGroupId,
                });
              } else {
                createRow('New card');
              }
            }}
            onDeleteRow={deleteRow}
          />
        ) : activeView?.type === 'list' ? (
          <ListView
            properties={properties}
            rows={rows}
            view={activeView}
            onAddRow={() => createRow()}
            onDeleteRow={deleteRow}
          />
        ) : activeView?.type === 'gallery' ? (
          <GalleryView
            properties={properties}
            rows={rows}
            view={activeView}
            onAddRow={() => createRow()}
            onDeleteRow={deleteRow}
          />
        ) : activeView?.type === 'calendar' ? (
          <CalendarView properties={properties} rows={rows} view={activeView} />
        ) : activeView && isChartViewType(activeView.type) ? (
          <ChartView
            properties={properties}
            rows={rows}
            view={activeView}
            databaseTitle={database.title}
            onChangeType={(type) => updateView({ id: activeView.id, input: { type } })}
            onUpdateView={(input) => updateView({ id: activeView.id, input })}
          />
        ) : (
          activeView && (
            <TableView
              properties={properties}
              rows={rows}
              view={activeView}
              aggregations={aggregations}
              hiddenProperties={hiddenProperties}
              propertyActions={propertyActions}
              onCellChange={updateCell}
              onAddRow={() => createRow()}
              onDeleteRow={deleteRow}
            />
          )
        )}
      </div>
    </div>
  );
}
