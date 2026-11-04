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

export function PropertyCell({ property, value, isTitle, onChange, className }: PropertyCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState(String(value ?? ''));

  if (isTitle || property.type === 'title') {
    if (isEditing) {
      return (
        <input
          autoFocus
          className={cn(
            'w-full bg-transparent px-2 py-1 text-sm font-semibold outline-none ring-1 ring-primary rounded',
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
      <div
        onClick={() => {
          setTempText(String(value ?? ''));
          setIsEditing(true);
        }}
        className={cn(
          'w-full cursor-text truncate px-2 py-1 text-sm font-medium hover:bg-muted/50 rounded transition-colors',
          !value && 'text-muted-foreground italic',
          className,
        )}
      >
        {value ? String(value) : 'Untitled'}
      </div>
    );
  }

  if (property.type === 'checkbox') {
    const isChecked = Boolean(value);
    return (
      <div className="flex items-center px-2 py-1">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
        />
      </div>
    );
  }

  if (property.type === 'status') {
    const options = property.statusConfig?.options ?? [];
    const currentOpt = options.find((opt) => opt.id === value);

    return (
      <div className="relative group px-2 py-1">
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          className="text-xs bg-transparent border-none outline-none cursor-pointer appearance-none pr-4 font-medium"
        >
          <option value="">No Status</option>
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
      <div className="relative group px-2 py-1">
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          className="text-xs bg-transparent border-none outline-none cursor-pointer appearance-none pr-4 font-medium"
        >
          <option value="">Empty</option>
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
          className={cn(
            'w-full bg-transparent px-2 py-1 text-sm outline-none ring-1 ring-primary rounded font-mono',
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
      <div
        onClick={() => {
          setTempText(value !== null && value !== undefined ? String(value) : '');
          setIsEditing(true);
        }}
        className={cn(
          'w-full cursor-text truncate px-2 py-1 text-sm font-mono hover:bg-muted/50 rounded transition-colors',
          (value === null || value === undefined) && 'text-muted-foreground italic',
          className,
        )}
      >
        {value !== null && value !== undefined ? String(value) : 'Empty'}
      </div>
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
          className="w-full bg-transparent px-2 py-1 text-xs outline-none ring-1 ring-primary rounded"
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
      <div
        onClick={() => {
          setTempText(value ? String(value) : '');
          setIsEditing(true);
        }}
        className="w-full cursor-text truncate px-2 py-1 text-xs text-primary underline underline-offset-2 hover:bg-muted/50 rounded"
      >
        {value ? String(value) : <span className="text-muted-foreground italic">Empty URL</span>}
      </div>
    );
  }

  // Fallback for text / other properties
  if (isEditing) {
    return (
      <input
        autoFocus
        className="w-full bg-transparent px-2 py-1 text-sm outline-none ring-1 ring-primary rounded"
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
    <div
      onClick={() => {
        setTempText(value ? String(value) : '');
        setIsEditing(true);
      }}
      className={cn(
        'w-full cursor-text truncate px-2 py-1 text-sm hover:bg-muted/50 rounded transition-colors',
        !value && 'text-muted-foreground italic',
        className,
      )}
    >
      {value ? String(value) : 'Empty'}
    </div>
  );
}
