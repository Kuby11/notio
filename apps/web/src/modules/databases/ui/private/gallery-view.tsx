'use client';

import type { DatabaseProperty, DatabaseRow, DatabaseView } from '@notio/contracts';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../../../../shared/ui/button';
import { PropertyValueDisplay } from './property-value';

export interface GalleryViewProps {
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  view: DatabaseView;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
}

function visibleProperties(properties: DatabaseProperty[], view: DatabaseView) {
  const selected =
    view.visiblePropertyIds.length > 0
      ? properties.filter((property) => view.visiblePropertyIds.includes(property.id))
      : properties;

  return selected.filter((property) => property.type !== 'title');
}

/** Notion-style gallery: each database page becomes a card. */
export function GalleryView({ properties, rows, view, onAddRow, onDeleteRow }: GalleryViewProps) {
  const t = useTranslations('databases.views');
  const tCommon = useTranslations('common');
  const fields = visibleProperties(properties, view);

  return (
    <div className="p-4">
      {rows.length === 0 ? (
        <p className="text-muted-foreground mb-3 text-sm">{t('emptyRows')}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((row) => (
          <article
            key={row.id}
            className="group border-border bg-card hover:shadow-md relative overflow-hidden rounded-xl border shadow-xs transition-shadow"
          >
            <div className="bg-muted/50 text-muted-foreground flex aspect-[4/3] items-center justify-center text-2xl font-semibold">
              {row.title.trim().charAt(0).toUpperCase() || '·'}
            </div>
            <div className="p-3">
              <p className="text-foreground truncate text-sm font-medium">
                {row.title || tCommon('untitled')}
              </p>
              {fields.length > 0 ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {fields.map((property) => (
                    <PropertyValueDisplay
                      key={property.id}
                      property={property}
                      value={row.properties[property.id] ?? null}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <Button
              variant="ghost"
              size="icon-xs"
              title="Delete row"
              aria-label="Delete row"
              onClick={() => onDeleteRow(row.id)}
              className="text-destructive hover:bg-destructive/10 absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </article>
        ))}

        <button
          type="button"
          onClick={onAddRow}
          className="border-border text-muted-foreground hover:bg-muted/30 hover:text-foreground flex min-h-52 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm transition-colors"
        >
          <Plus className="size-5" aria-hidden="true" />
          {t('newRow')}
        </button>
      </div>
    </div>
  );
}
