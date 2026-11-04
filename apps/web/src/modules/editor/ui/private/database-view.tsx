'use client';

import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Database as DatabaseIcon } from 'lucide-react';
import { DatabaseView } from '../../../databases';
import { databaseBlockBridge } from '../../utils/database-block';

/**
 * Inline database block: a thin wrapper over the databases module's view.
 *
 * The database row is created by the editor layer before the id reaches attrs,
 * so an empty id only appears while the request is in flight.
 */
export function DatabaseBlockView({ node }: ReactNodeViewProps) {
  const t = useTranslations('editor.databaseBlock');
  const databaseId = typeof node.attrs['databaseId'] === 'string' ? node.attrs['databaseId'] : '';
  const viewId = typeof node.attrs['viewId'] === 'string' ? node.attrs['viewId'] : '';

  return (
    <NodeViewWrapper
      as="div"
      className="notio-database"
      data-block-type="database"
      data-database-id={databaseId}
      contentEditable={false}
    >
      {databaseId.length > 0 ? (
        <DatabaseView databaseId={databaseId} initialViewId={viewId || undefined} />
      ) : (
        <div className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-6 text-sm">
          {t('creating')}
        </div>
      )}
    </NodeViewWrapper>
  );
}

/**
 * Whole-page database link: a chip that opens the database route. The title is
 * read through the database bridge, so the page stays correct after a rename.
 */
export function DatabaseLinkView({ node, editor }: ReactNodeViewProps) {
  const t = useTranslations('editor.databaseBlock');
  const databaseId = typeof node.attrs['databaseId'] === 'string' ? node.attrs['databaseId'] : '';
  const bridge = databaseBlockBridge(editor);
  const [title, setTitle] = useState<string | null>(null);

  useEffect(() => {
    if (databaseId.length === 0) {
      setTitle(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const database = await bridge.getDatabase(databaseId);

        if (!cancelled) {
          setTitle(database?.title ?? null);
        }
      } catch {
        if (!cancelled) {
          setTitle(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [databaseId, bridge]);

  const href = `/workspaces/${bridge.workspaceId}/databases/${databaseId}`;

  return (
    <NodeViewWrapper
      as="div"
      className="notio-database-link-block"
      data-block-type="databaseLink"
      data-database-id={databaseId}
      contentEditable={false}
    >
      {databaseId.length > 0 ? (
        <a
          href={href}
          aria-label={title || t('linkLabel')}
          className="notio-page-link"
          onClick={(event) => {
            event.preventDefault();
            bridge.openDatabase(databaseId);
          }}
        >
          <span className="notio-page-icon" aria-hidden="true">
            <DatabaseIcon className="size-4" />
          </span>
          <span className="notio-page-title">{title || t('linkLabel')}</span>
        </a>
      ) : (
        <div className="text-muted-foreground border-border rounded-xl border border-dashed px-4 py-6 text-sm">
          {t('creating')}
        </div>
      )}
    </NodeViewWrapper>
  );
}
