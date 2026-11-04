'use client';

import type { DatabaseProperty, DatabaseRow, DatabaseView } from '@notio/contracts';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '../../../../shared/ui/button';
import { PropertyValueDisplay } from './property-value';

export interface ListViewProps {
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

/** Notion-style list: one row per database page, with its visible fields. */
export function ListView({ properties, rows, view, onAddRow, onDeleteRow }: ListViewProps) {
  const t = useTranslations('databases.views');
  const tCommon = useTranslations('common');
  const fields = visibleProperties(properties, view);

  return (
    <div className="p-3 sm:p-4">
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-sm">{t('emptyRows')}</p>
        ) : (
          <ul className="divide-border divide-y">
            {rows.map((row) => (
              <li key={row.id} className="group hover:bg-muted/25 flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-sm font-medium">
                    {row.title || tCommon('untitled')}
                  </p>
                  {fields.length > 0 ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
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
                  className="text-destructive hover:bg-destructive/10 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="border-border/60 border-t p-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddRow}
            className="text-muted-foreground hover:text-foreground h-8 w-full justify-start text-xs"
          >
            <Plus aria-hidden="true" />
            {t('newRow')}
          </Button>
        </div>
      </div>
    </div>
  );
}
