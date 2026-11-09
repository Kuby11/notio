'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export interface DatabaseTitleProps {
  databaseId: string;
  title: string;
  onRename: (title: string) => void;
}

/**
 * Inline database title.
 *
 * A database is renamed in place, like a page title: the field looks like the
 * heading, saves on blur / Enter and reverts on Escape. An empty name is not a
 * rename — the previous title comes back.
 */
export function DatabaseTitle({ databaseId, title, onRename }: DatabaseTitleProps) {
  const t = useTranslations('databases.view');
  const tCommon = useTranslations('common');
  const [value, setValue] = useState(title);

  // Switching to another database (or a rename from the tree) resets the field.
  useEffect(() => {
    setValue(title);
  }, [databaseId, title]);

  function commit(): void {
    const next = value.trim();

    if (next.length === 0) {
      setValue(title);
      return;
    }

    if (next !== title) {
      onRename(next);
    }
  }

  return (
    <input
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }

        if (event.key === 'Escape') {
          setValue(title);
          event.currentTarget.blur();
        }
      }}
      aria-label={t('titleLabel')}
      placeholder={tCommon('untitled')}
      className="text-foreground focus:bg-muted/40 -mx-1 min-w-0 flex-1 truncate rounded bg-transparent px-1 text-lg font-bold tracking-tight outline-none"
    />
  );
}
