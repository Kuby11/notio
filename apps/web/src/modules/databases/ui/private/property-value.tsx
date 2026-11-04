'use client';

import type { DatabaseProperty, PropertyValue } from '@notio/contracts';
import { useLocale } from 'next-intl';
import { PropertyBadge } from './property-badge';

function optionFor(property: DatabaseProperty, value: string) {
  const options =
    property.type === 'status'
      ? (property.statusConfig?.options ?? [])
      : (property.selectConfig?.options ?? []);

  return options.find((option) => option.id === value);
}

function dateValue(value: unknown, locale: string): string | null {
  const start =
    typeof value === 'object' &&
    value !== null &&
    'start' in value &&
    typeof (value as { start?: unknown }).start === 'string'
      ? (value as { start: string }).start
      : typeof value === 'string'
        ? value
        : null;

  if (start === null || start.length === 0) {
    return null;
  }

  const date = new Date(`${start.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return start;
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Read-only value renderer for card-like views. Editing stays in the table and
 * board views; here the same status/select/date labels are reused so the
 * database does not become a wall of raw option ids.
 */
export function PropertyValueDisplay({
  property,
  value,
}: {
  property: DatabaseProperty;
  value: PropertyValue | null | undefined;
}) {
  const locale = useLocale();

  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return null;
    }

    if (property.type === 'files') {
      const names = value.map((item) => (typeof item === 'string' ? item : item.name));
      return <span className="text-muted-foreground text-xs">{names.join(', ')}</span>;
    }

    const items = value.filter((item): item is string => typeof item === 'string');

    if (items.length === 0) {
      return null;
    }

    if (property.type === 'multi_select') {
      return (
        <span className="flex flex-wrap items-center gap-1">
          {items.map((item) => {
            const option = optionFor(property, item);

            return option ? (
              <PropertyBadge key={item} label={option.name} color={option.color} />
            ) : (
              <span key={item} className="text-muted-foreground text-xs">
                {item}
              </span>
            );
          })}
        </span>
      );
    }

    return <span className="text-muted-foreground text-xs">{items.join(', ')}</span>;
  }

  if (typeof value === 'object') {
    const formatted = dateValue(value, locale);

    return formatted ? <span className="text-muted-foreground text-xs">{formatted}</span> : null;
  }

  if (property.type === 'status' || property.type === 'select') {
    const option = optionFor(property, String(value));

    return option ? (
      <PropertyBadge label={option.name} color={option.color} />
    ) : (
      <span className="text-muted-foreground text-xs">{String(value)}</span>
    );
  }

  if (property.type === 'checkbox') {
    return (
      <span className="text-muted-foreground text-xs">
        {value ? '✓' : '✗'} {property.name}
      </span>
    );
  }

  return (
    <span className="text-muted-foreground max-w-48 truncate text-xs">{String(value)}</span>
  );
}
