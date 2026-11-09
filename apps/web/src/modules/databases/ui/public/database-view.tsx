'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useDatabases } from '../../hooks/use-databases';
import { BoardView } from '../private/board-view';
import { CalendarView } from '../private/calendar-view';
import { ChartView } from '../private/chart-view';
import { GalleryView } from '../private/gallery-view';
import { ListView } from '../private/list-view';
import { DatabaseTitle } from '../private/database-title';
import { RowPeek } from '../private/row-peek';
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
  const tv = useTranslations('databases.view');
  const {
    database,
    rows,
    rawRows,
    views,
    activeView,
    groups,
    aggregations,
    isLoading,
    isError,
    refetch,
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
    updateDatabase,
  } = useDatabases(databaseId, initialViewId);

  // The row opened in the peek dialog. Stored by id and read from the raw rows:
  // an edit updates the cache and the dialog follows it.
  const [peekRowId, setPeekRowId] = useState<string | null>(null);
  const openedRow =
    peekRowId === null ? null : (rawRows.find((row) => row.id === peekRowId) ?? null);

  if (isLoading && !database) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="text-muted-foreground flex h-64 items-center justify-center text-sm animate-pulse"
      >
        {tv('loading')}
      </div>
    );
  }

  if (isError || !database) {
    return (
      <div role="alert" className="flex h-64 flex-col items-center justify-center gap-3 text-sm">
        <p className="text-destructive">{tv('loadFailed')}</p>
        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs font-medium"
        >
          {tv('retry')}
        </button>
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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {database.icon && <span className="text-xl">{database.icon}</span>}
          <DatabaseTitle
            databaseId={database.id}
            title={database.title}
            onRename={(title) => updateDatabase({ title })}
          />
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
      <div className="flex-1" role="tabpanel" aria-label={activeView?.name ?? database.title}>
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
            onOpenRow={(row) => setPeekRowId(row.id)}
          />
        ) : activeView?.type === 'list' ? (
          <ListView
            properties={properties}
            rows={rows}
            view={activeView}
            onAddRow={() => createRow()}
            onDeleteRow={deleteRow}
            onOpenRow={(row) => setPeekRowId(row.id)}
          />
        ) : activeView?.type === 'gallery' ? (
          <GalleryView
            properties={properties}
            rows={rows}
            view={activeView}
            onAddRow={() => createRow()}
            onDeleteRow={deleteRow}
            onOpenRow={(row) => setPeekRowId(row.id)}
          />
        ) : activeView?.type === 'calendar' ? (
          <CalendarView
            properties={properties}
            rows={rows}
            view={activeView}
            onOpenRow={(row) => setPeekRowId(row.id)}
          />
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

      <RowPeek
        row={openedRow}
        properties={properties}
        onClose={() => setPeekRowId(null)}
        onChange={(propertyId, value) => {
          if (openedRow) {
            updateCell(openedRow, propertyId, value);
          }
        }}
        onDelete={() => {
          if (openedRow) {
            deleteRow(openedRow.id);
            setPeekRowId(null);
          }
        }}
      />
    </div>
  );
}
