'use client';

import type { DatabaseProperty } from '@notio/contracts';
import {
  CalendarDays,
  Copy,
  Eye,
  EyeOff,
  Hash,
  Link2,
  Mail,
  Plus,
  SquareCheck,
  Trash2,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '../../../../shared/ui/button';
import { Input } from '../../../../shared/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../shared/ui/popover';

/** Property types a user can create or switch to from the table header. */
export const EDITABLE_PROPERTY_TYPES = [
  'text',
  'number',
  'url',
  'email',
  'checkbox',
  'date',
] as const;

export type EditablePropertyType = (typeof EDITABLE_PROPERTY_TYPES)[number];

const TYPE_ICONS: Record<EditablePropertyType, LucideIcon> = {
  text: Type,
  number: Hash,
  url: Link2,
  email: Mail,
  checkbox: SquareCheck,
  date: CalendarDays,
};

/** Icon for the type in the header; select/status/title fall back to the text icon. */
export function propertyTypeIcon(type: DatabaseProperty['type']): LucideIcon {
  return TYPE_ICONS[type as EditablePropertyType] ?? Type;
}

interface NewPropertyButtonProps {
  onAdd: (type: EditablePropertyType) => void;
  hiddenProperties: DatabaseProperty[];
  onShow: (propertyId: string) => void;
}

/** Header "+": pick a type for the new property; hidden properties can be restored. */
export function NewPropertyButton({ onAdd, hiddenProperties, onShow }: NewPropertyButtonProps) {
  const t = useTranslations('databases.property');
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t('new')}
            title={t('new')}
            className="text-muted-foreground"
          />
        }
      >
        <Plus aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1">
        <p className="text-muted-foreground px-2 py-1.5 text-[11px] font-medium tracking-wide uppercase">
          {t('typesHeading')}
        </p>

        {EDITABLE_PROPERTY_TYPES.map((type) => {
          const Icon = TYPE_ICONS[type];

          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
              className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{t(`types.${type}`)}</span>
            </button>
          );
        })}

        {hiddenProperties.length > 0 ? (
          <>
            <div className="my-1 border-t" />
            <p className="text-muted-foreground px-2 py-1.5 text-[11px] font-medium tracking-wide uppercase">
              {t('hiddenHeading')}
            </p>
            {hiddenProperties.map((property) => {
              const Icon = propertyTypeIcon(property.type);

              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => {
                    onShow(property.id);
                    setOpen(false);
                  }}
                  className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{property.name}</span>
                  <Eye className="text-muted-foreground ml-auto size-3.5" aria-hidden="true" />
                </button>
              );
            })}
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

interface PropertyMenuProps {
  property: DatabaseProperty;
  onRename: (name: string) => void;
  onChangeType: (type: EditablePropertyType) => void;
  onDuplicate: (name: string) => void;
  onHide: () => void;
  onDelete: () => void;
}

/**
 * Clickable property header: rename, change type, duplicate, hide or delete.
 *
 * The title property owns the row identity, so only its name is editable —
 * changing its type or removing it would break every row of the database.
 */
export function PropertyMenu({
  property,
  onRename,
  onChangeType,
  onDuplicate,
  onHide,
  onDelete,
}: PropertyMenuProps) {
  const t = useTranslations('databases.property');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(property.name);
  const Icon = propertyTypeIcon(property.type);
  const isTitle = property.type === 'title';

  useEffect(() => {
    setName(property.name);
  }, [property.id, property.name]);

  function commitName(): void {
    const trimmed = name.trim();

    if (trimmed.length === 0 || trimmed === property.name) {
      setName(property.name);
      return;
    }

    onRename(trimmed);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={property.name}
            className="hover:bg-muted/60 flex w-full min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors"
          />
        }
      >
        <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{property.name}</span>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-2">
        <Input
          autoFocus
          value={name}
          aria-label={t('nameLabel')}
          placeholder={t('nameLabel')}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitName();
            }
          }}
        />

        {isTitle ? null : (
          <>
            <p className="text-muted-foreground px-1 pt-1 text-[11px] font-medium tracking-wide uppercase">
              {t('changeType')}
            </p>

            <div className="grid grid-cols-2 gap-0.5">
              {EDITABLE_PROPERTY_TYPES.map((type) => {
                const TypeIcon = TYPE_ICONS[type];
                const current = property.type === type;

                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={current}
                    onClick={() => {
                      onChangeType(type);
                      setOpen(false);
                    }}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                      current ? 'bg-muted font-medium' : 'hover:bg-accent'
                    }`}
                  >
                    <TypeIcon className="size-4 shrink-0" aria-hidden="true" />
                    <span>{t(`types.${type}`)}</span>
                  </button>
                );
              })}
            </div>

            <div className="my-1 border-t" />

            <button
              type="button"
              onClick={() => {
                onDuplicate(t('copySuffix', { name: property.name }));
                setOpen(false);
              }}
              className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
            >
              <Copy className="size-4 shrink-0" aria-hidden="true" />
              <span>{t('duplicate')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onHide();
                setOpen(false);
              }}
              className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
            >
              <EyeOff className="size-4 shrink-0" aria-hidden="true" />
              <span>{t('hide')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onDelete();
                setOpen(false);
              }}
              className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
            >
              <Trash2 className="size-4 shrink-0" aria-hidden="true" />
              <span>{t('delete')}</span>
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
