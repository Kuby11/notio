'use client';

import type { DatabaseProperty, DatabaseRow, PropertyValue } from '@notio/contracts';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '../../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../shared/ui/dialog';
import { PropertyCell } from './property-cell';
import { PropertyValueDisplay } from './property-value';

/**
 * Property types the popover can edit. Computed and relation-like types are
 * shown read-only: there is nothing to type into them.
 */
const EDITABLE_TYPES = new Set<DatabaseProperty['type']>([
  'text',
  'number',
  'url',
  'email',
  'phone_number',
  'checkbox',
  'date',
  'select',
  'status',
]);

export interface RowPeekProps {
  /** The row to show; null keeps the dialog closed. */
  row: DatabaseRow | null;
  properties: DatabaseProperty[];
  onClose: () => void;
  onChange: (propertyId: string, value: PropertyValue | null) => void;
  onDelete: () => void;
}

/**
 * Database page popover: the card-like views (list, gallery, board, calendar)
 * show their data read-only, so opening a row gives them an editor.
 *
 * Every change goes to the same `updateCell` path the table uses; the dialog
 * itself holds only the title draft, because a controlled server value would
 * move the caret on each keystroke.
 */
export function RowPeek({ row, properties, onClose, onChange, onDelete }: RowPeekProps) {
  return (
    <Dialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {row ? (
        <RowPeekBody
          key={row.id}
          row={row}
          properties={properties}
          onChange={onChange}
          onDelete={onDelete}
        />
      ) : null}
    </Dialog>
  );
}

interface RowPeekBodyProps {
  row: DatabaseRow;
  properties: DatabaseProperty[];
  onChange: (propertyId: string, value: PropertyValue | null) => void;
  onDelete: () => void;
}

function RowPeekBody({ row, properties, onChange, onDelete }: RowPeekBodyProps) {
  const t = useTranslations('databases.peek');
  const tCommon = useTranslations('common');
  const [title, setTitle] = useState(row.title);

  function commitTitle(): void {
    if (title !== row.title) {
      onChange('title', title);
    }
  }

  const fields = properties.filter((property) => property.type !== 'title');

  return (
    <DialogContent className="max-w-xl gap-0 p-0 sm:max-w-xl" showCloseButton>
      <DialogHeader className="sr-only">
        <DialogTitle>{row.title || tCommon('untitled')}</DialogTitle>
        <DialogDescription>{t('hint')}</DialogDescription>
      </DialogHeader>

      <div className="max-h-[70vh] overflow-y-auto px-6 pt-6 pb-4">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          aria-label={t('titleLabel')}
          placeholder={tCommon('untitled')}
          className="text-foreground placeholder:text-muted-foreground/60 w-full bg-transparent text-2xl font-bold tracking-tight outline-none"
        />

        {fields.length > 0 ? (
          <div className="mt-5 flex flex-col">
            {fields.map((property) => (
              <div
                key={property.id}
                className="hover:bg-muted/30 grid grid-cols-[minmax(96px,160px)_1fr] items-center gap-2 rounded-md px-1 py-1"
              >
                <span className="text-muted-foreground truncate text-sm">{property.name}</span>
                {EDITABLE_TYPES.has(property.type) ? (
                  <PropertyCell
                    property={property}
                    value={row.properties[property.id] ?? null}
                    onChange={(value) => onChange(property.id, value)}
                  />
                ) : (
                  <PropertyValueDisplay
                    property={property}
                    value={row.properties[property.id] ?? null}
                  />
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-6 py-3">
        <span className="text-muted-foreground text-[11px]">{t('hint')}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:bg-destructive/10 shrink-0"
        >
          <Trash2 data-icon="inline-start" aria-hidden="true" />
          {t('deleteRow')}
        </Button>
      </div>
    </DialogContent>
  );
}
