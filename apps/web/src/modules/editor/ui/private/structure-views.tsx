'use client';

import type { Page } from '@notio/contracts';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { useTranslations } from 'next-intl';
import { Fragment, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { pageLinkBridge } from '../../utils/page-link';

/** Contract limits: columns may range from 2 to 5. */
const COLUMNS_MIN = 2;
const COLUMNS_MAX = 5;

/** Column context for transactions: list position, node and column index. */
interface ColumnContext {
  listPos: number;
  list: ProseMirrorNode;
  index: number;
}

function columnContext(
  editor: ReactNodeViewProps['editor'],
  getPos: ReactNodeViewProps['getPos'],
): ColumnContext | null {
  const position = typeof getPos === 'function' ? getPos() : undefined;

  if (typeof position !== 'number') {
    return null;
  }

  const $pos = editor.state.doc.resolve(position);

  if ($pos.parent.type.name !== 'columnsList') {
    return null;
  }

  return {
    listPos: $pos.before(),
    list: $pos.parent,
    index: $pos.indexAfter() - 1,
  };
}

/** Rebuilds columnsList with the new column set and places the cursor. */
function replaceColumns(
  editor: ReactNodeViewProps['editor'],
  context: ColumnContext,
  columns: ProseMirrorNode[],
  focusOffset?: number,
): void {
  const { schema, tr } = editor.state;
  const list = editor.state.doc.nodeAt(context.listPos);

  if (!list) {
    return;
  }

  const next = schema.nodes['columnsList']?.create(list.attrs, columns);

  if (!next) {
    return;
  }

  tr.replaceWith(context.listPos, context.listPos + list.nodeSize, next);

  if (focusOffset !== undefined) {
    tr.setSelection(TextSelection.near(tr.doc.resolve(context.listPos + focusOffset + 1)));
  }

  editor.view.dispatch(tr.scrollIntoView());
}

/**
 * A column (as in Notion): ordinary editable content plus the
 * "add column to the right" and "remove column" buttons on hover. The buttons sit
 * outside NodeViewContent so the cursor inside the column never touches them.
 */
export function ColumnsColumnView({ editor, getPos }: ReactNodeViewProps) {
  const t = useTranslations('editor.columns');
  const context = columnContext(editor, getPos);
  const totalColumns = context?.list.childCount ?? COLUMNS_MIN;

  function addColumnAfter(): void {
    if (!context || totalColumns >= COLUMNS_MAX) {
      return;
    }

    const { schema } = editor.state;
    const paragraph = schema.nodes['paragraph']?.create();
    const fresh = paragraph ? schema.nodes['columnsColumn']?.create(null, [paragraph]) : undefined;

    if (!fresh) {
      return;
    }

    const columns: ProseMirrorNode[] = [];
    let focusOffset = 1;

    for (let i = 0; i < context.list.childCount; i += 1) {
      const column = context.list.child(i);

      columns.push(column);

      if (i <= context.index) {
        focusOffset += column.nodeSize;
      }
    }

    columns.splice(context.index + 1, 0, fresh);
    replaceColumns(editor, context, columns, focusOffset);
  }

  function deleteColumn(): void {
    if (!context || totalColumns <= COLUMNS_MIN) {
      return;
    }

    const columns: ProseMirrorNode[] = [];

    for (let i = 0; i < context.list.childCount; i += 1) {
      if (i !== context.index) {
        columns.push(context.list.child(i));
      }
    }

    replaceColumns(editor, context, columns);
  }

  return (
    // data-column duplicates the renderHTML attribute: the React node view builds its
    // own DOM, PM attributes never get there.
    <NodeViewWrapper className="notio-column" data-column="">
      <NodeViewContent className="notio-column-content" />
      <span className="notio-column-controls">
        <button
          type="button"
          aria-label={t('delete')}
          title={t('delete')}
          disabled={totalColumns <= COLUMNS_MIN}
          onClick={deleteColumn}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={t('addRight')}
          title={t('addRight')}
          disabled={totalColumns >= COLUMNS_MAX}
          onClick={addColumnAfter}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      </span>
    </NodeViewWrapper>
  );
}

/**
 * Page link: a chip with an icon and a live title (fetched when
 * shown — renaming the target page does not break the link). A click
 * navigates to the page; with no page the chip opens the picker dialog.
 */
export function PageLinkView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  const t = useTranslations('editor.pageLink');
  const tCommon = useTranslations('common');
  const pageId = typeof node.attrs['pageId'] === 'string' ? node.attrs['pageId'] : '';
  const bridge = pageLinkBridge(editor);
  const [page, setPage] = useState<Page | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [candidates, setCandidates] = useState<Page[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (pageId.length === 0) {
      setPage(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const loaded = await bridge.getPage(pageId);

        if (!cancelled) {
          setPage(loaded);
        }
      } catch {
        if (!cancelled) {
          setPage(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // The bridge is re-read on every node view render: the dependency is pageId.
  }, [pageId]);

  useEffect(() => {
    if (!pickerOpen || candidates !== null) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const list = await bridge.listPages();

        if (!cancelled) {
          setCandidates(list);
        }
      } catch {
        if (!cancelled) {
          setCandidates([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pickerOpen, candidates]);

  function pickPage(target: Page): void {
    updateAttributes({ pageId: target.id });
    setPickerOpen(false);
    setCandidates(null);
    setQuery('');
  }

  const filtered = (candidates ?? []).filter((candidate) =>
    candidate.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <NodeViewWrapper as="div" className="notio-page-link-block">
      {pageId.length === 0 ? (
        <button
          type="button"
          className="notio-page-link is-empty"
          onClick={() => {
            setCandidates(null);
            setPickerOpen(true);
          }}
        >
          {t('pick')}
        </button>
      ) : (
        <a
          role="link"
          tabIndex={0}
          aria-label={page?.title || t('page')}
          className="notio-page-link"
          href={`/workspaces/${bridge.workspaceId}/${pageId}`}
          onClick={(event) => {
            event.preventDefault();
            bridge.navigate(`/workspaces/${bridge.workspaceId}/${pageId}`);
          }}
        >
          <span className="notio-page-icon" aria-hidden="true">
            {page?.icon ?? '📄'}
          </span>
          <span className="notio-page-title">
            {page === null ? t('loadingChip') : page.title || tCommon('untitled')}
          </span>
        </a>
      )}

      <Dialog
        open={pickerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setPickerOpen(false);
            setCandidates(null);
            setQuery('');
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('dialogTitle')}</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={query}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchLabel')}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="max-h-80 overflow-y-auto">
            {candidates === null ? (
              <p className="text-muted-foreground p-2 text-sm">{t('loading')}</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground p-2 text-sm">{t('empty')}</p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((candidate) => (
                  <li key={candidate.id}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      onClick={() => pickPage(candidate)}
                    >
                      <span aria-hidden="true">{candidate.icon ?? '📄'}</span>
                      <span className="truncate">{candidate.title || tCommon('untitled')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </NodeViewWrapper>
  );
}

/**
 * Breadcrumbs in the document: the path from the workspace root to the current
 * page, segments are links (Notion behaves the same way). The chain is computed
 * when shown; the last segment is the page itself.
 */
export function BreadcrumbView({ editor }: ReactNodeViewProps) {
  const t = useTranslations('editor.breadcrumb');
  const tCommon = useTranslations('common');
  const bridge = pageLinkBridge(editor);
  const [chain, setChain] = useState<Page[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setChain(null);
    setFailed(false);

    void (async () => {
      try {
        const pages: Page[] = [];
        let current = await bridge.getPage(bridge.currentPageId);
        pages.unshift(current);

        for (let guard = 0; current.parentId && guard < 20; guard += 1) {
          current = await bridge.getPage(current.parentId);
          pages.unshift(current);
        }

        if (!cancelled) {
          setChain(pages);
        }
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // The bridge changes with the editor; the chain depends on the page.
  }, [bridge.currentPageId]);

  if (failed) {
    return (
      <NodeViewWrapper as="div">
        <span className="notio-breadcrumb-muted">{t('unavailable')}</span>
      </NodeViewWrapper>
    );
  }

  if (chain === null) {
    return (
      <NodeViewWrapper as="div">
        <span className="notio-breadcrumb-muted">{t('loading')}</span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="notio-breadcrumb">
      <Breadcrumb>
        <BreadcrumbList>
          {chain.map((item, index) => {
            const isLast = index === chain.length - 1;
            const label = item.title || tCommon('untitled');

            // The divider is a sibling of BreadcrumbItem: li inside li breaks hydration.
            return (
              <Fragment key={item.id}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>
                      <span aria-hidden="true">{item.icon ?? '📄'}</span>
                      <span className="ml-1">{label}</span>
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      href={`/workspaces/${bridge.workspaceId}/${item.id}`}
                      onClick={(event) => {
                        event.preventDefault();
                        bridge.navigate(`/workspaces/${bridge.workspaceId}/${item.id}`);
                      }}
                    >
                      <span aria-hidden="true">{item.icon ?? '📄'}</span>
                      <span className="ml-1">{label}</span>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast ? <BreadcrumbSeparator /> : null}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </NodeViewWrapper>
  );
}
