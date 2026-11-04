import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { DatabaseProperty, PropertyValue } from '@notio/contracts';
import { PropertyBadge } from './property-badge';
import { DatePicker } from '../../../../shared/ui/date-picker';
import { cn } from 'cn';

export interface PropertyCellProps {
  property: DatabaseProperty;
  value: PropertyValue | null;
  isTitle?: boolean;
  onChange: (newValue: PropertyValue | null) => void;
  className?: string;
}

/**
 * A cell is an editor, not a document: its read mode is a button so it can be
 * reached with Tab and opened with Enter/Space. A clickable `<div>` is invisible
 * to the keyboard and to assistive technology.
 */
const CELL_BUTTON_CLASS =
  'w-full cursor-text truncate rounded px-2 py-1 text-left hover:bg-muted/50 transition-colors';

export function PropertyCell({ property, value, isTitle, onChange, className }: PropertyCellProps) {
  const t = useTranslations('databases.property');
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState(String(value ?? ''));

  if (isTitle || property.type === 'title') {
    if (isEditing) {
      return (
        <input
          autoFocus
          aria-label={property.name}
          className={cn(
            'ring-primary w-full rounded bg-transparent px-2 py-1 text-sm font-semibold outline-none ring-1',
            className,
          )}
          value={tempText}
          onChange={(e) => setTempText(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            if (tempText !== String(value ?? '')) {
              onChange(tempText);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsEditing(false);
              onChange(tempText);
            }
          }}
        />
      );
    }
    return (
      <button
        type="button"
        aria-label={value ? String(value) : t('untitled')}
        onClick={() => {
          setTempText(String(value ?? ''));
          setIsEditing(true);
        }}
        className={cn(
          CELL_BUTTON_CLASS,
          'text-sm font-medium',
          !value && 'text-muted-foreground italic',
          className,
        )}
      >
        {value ? String(value) : t('untitled')}
      </button>
    );
  }

  if (property.type === 'checkbox') {
    const isChecked = Boolean(value);
    return (
      <div className="flex items-center px-2 py-1">
        <input
          type="checkbox"
          aria-label={property.name}
          checked={isChecked}
          onChange={(e) => onChange(e.target.checked)}
          className="border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer rounded"
        />
      </div>
    );
  }

  if (property.type === 'status') {
    const options = property.statusConfig?.options ?? [];
    const currentOpt = options.find((opt) => opt.id === value);

    return (
      <div className="group relative px-2 py-1">
        <select
          aria-label={property.name}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          className="cursor-pointer appearance-none border-none bg-transparent pr-4 text-xs font-medium outline-none"
        >
          <option value="">{t('noStatus')}</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
        {currentOpt && (
          <div className="pointer-events-none absolute inset-y-1 left-2 flex items-center">
            <PropertyBadge label={currentOpt.name} color={currentOpt.color} />
          </div>
        )}
      </div>
    );
  }

  if (property.type === 'select') {
    const options = property.selectConfig?.options ?? [];
    const currentOpt = options.find((opt) => opt.id === value);

    return (
      <div className="group relative px-2 py-1">
        <select
          aria-label={property.name}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          className="cursor-pointer appearance-none border-none bg-transparent pr-4 text-xs font-medium outline-none"
        >
          <option value="">{t('empty')}</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>
        {currentOpt && (
          <div className="pointer-events-none absolute inset-y-1 left-2 flex items-center">
            <PropertyBadge label={currentOpt.name} color={currentOpt.color} />
          </div>
        )}
      </div>
    );
  }

  if (property.type === 'number') {
    if (isEditing) {
      return (
        <input
          type="number"
          autoFocus
          aria-label={property.name}
          className={cn(
            'ring-primary w-full rounded bg-transparent px-2 py-1 font-mono text-sm outline-none ring-1',
            className,
          )}
          value={tempText}
          onChange={(e) => setTempText(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            const num = tempText.trim() === '' ? null : Number(tempText);
            onChange(num);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsEditing(false);
              const num = tempText.trim() === '' ? null : Number(tempText);
              onChange(num);
            }
          }}
        />
      );
    }
    return (
      <button
        type="button"
        aria-label={
          value !== null && value !== undefined ? String(value) : `${property.name}: ${t('empty')}`
        }
        onClick={() => {
          setTempText(value !== null && value !== undefined ? String(value) : '');
          setIsEditing(true);
        }}
        className={cn(
          CELL_BUTTON_CLASS,
          'font-mono text-sm',
          (value === null || value === undefined) && 'text-muted-foreground italic',
          className,
        )}
      >
        {value !== null && value !== undefined ? String(value) : t('empty')}
      </button>
    );
  }

  if (property.type === 'date') {
    const dateVal =
      typeof value === 'object' && value !== null && 'start' in value
        ? (value as { start: string }).start
        : typeof value === 'string'
          ? value
          : '';

    return (
      <div className="px-1 py-0.5">
        <DatePicker
          value={dateVal}
          onChange={(next) => onChange(next ? { start: next } : null)}
          ariaLabel={property.name}
        />
      </div>
    );
  }

  if (property.type === 'url') {
    if (isEditing) {
      return (
        <input
          type="url"
          autoFocus
          aria-label={property.name}
          className="ring-primary w-full rounded bg-transparent px-2 py-1 text-xs outline-none ring-1"
          value={tempText}
          onChange={(e) => setTempText(e.target.value)}
          onBlur={() => {
            setIsEditing(false);
            onChange(tempText.trim() || null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsEditing(false);
              onChange(tempText.trim() || null);
            }
          }}
        />
      );
    }
    return (
      <button
        type="button"
        aria-label={value ? String(value) : t('emptyUrl')}
        onClick={() => {
          setTempText(value ? String(value) : '');
          setIsEditing(true);
        }}
        className={cn(
          CELL_BUTTON_CLASS,
          'text-primary text-xs underline underline-offset-2',
          className,
        )}
      >
        {value ? (
          String(value)
        ) : (
          <span className="text-muted-foreground italic">{t('emptyUrl')}</span>
        )}
      </button>
    );
  }

  // Fallback for text / other properties
  if (isEditing) {
    return (
      <input
        autoFocus
        aria-label={property.name}
        className="ring-primary w-full rounded bg-transparent px-2 py-1 text-sm outline-none ring-1"
        value={tempText}
        onChange={(e) => setTempText(e.target.value)}
        onBlur={() => {
          setIsEditing(false);
          onChange(tempText.trim() || null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setIsEditing(false);
            onChange(tempText.trim() || null);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={value ? String(value) : `${property.name}: ${t('empty')}`}
      onClick={() => {
        setTempText(value ? String(value) : '');
        setIsEditing(true);
      }}
      className={cn(
        CELL_BUTTON_CLASS,
        'text-sm',
        !value && 'text-muted-foreground italic',
        className,
      )}
    >
      {value ? String(value) : t('empty')}
    </button>
  );
}
