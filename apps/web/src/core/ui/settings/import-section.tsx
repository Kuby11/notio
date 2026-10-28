'use client';

import type { BlockContent } from '@notio/contracts';
import { FileUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { importTitleFrom, parseMarkdownToBlocks, useBlockCreator } from '@/modules/editor';
import { formatNumber } from '@/core/preferences/preferences';
import { usePreferences } from '@/core/preferences/preferences.store';
import { usePages } from '@/modules/pages';
import { useWorkspaces } from '@/modules/workspaces';
import { Button } from '@/shared/ui/button';
import { toast } from '@/shared/ui/toast';
import { SettingsGroup, SettingsRow, SettingsSelect } from './settings-layout';

/** State of the parsed file: name, title of the future page and its blocks. */
interface ParsedImport {
  filename: string;
  title: string;
  blocks: BlockContent[];
}

/**
 * Import: a Markdown file becomes a new page in the chosen workspace. The
 * file is parsed locally (block count preview), then the page and the blocks
 * are created in order — the service appends them to the end, so sequential
 * creation preserves the order.
 */
export function ImportSection() {
  const t = useTranslations('settings.import');
  const router = useRouter();
  const { list } = useWorkspaces();
  const preferences = usePreferences();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [busy, setBusy] = useState(false);

  const workspaces = list.data ?? [];
  const targetWorkspaceId = workspaceId ?? workspaces[0]?.id ?? null;
  // The hook requires a workspaceId before one is picked: child queries are
  // disabled, only the createPage mutation is needed.
  const { createPage } = usePages(targetWorkspaceId ?? '', null, 'tree', { enabled: false });
  const createBlock = useBlockCreator();

  async function readFile(file: File): Promise<void> {
    if (file.size > 5 * 1024 * 1024) {
      toast(t('tooLarge'));
      return;
    }

    const text = await file.text();
    const blocks = parseMarkdownToBlocks(text);

    if (blocks.length === 0) {
      toast(t('empty'));
      return;
    }

    setParsed({
      filename: file.name,
      title: importTitleFrom(blocks, file.name, t('fallbackTitle')),
      blocks,
    });
  }

  async function runImport(): Promise<void> {
    if (!parsed || !targetWorkspaceId) {
      return;
    }

    setBusy(true);

    try {
      const page = await createPage.mutateAsync({
        workspaceId: targetWorkspaceId,
        parentId: null,
        title: parsed.title,
      });

      // Order matters: blocks are created sequentially and the service appends them.
      for (const block of parsed.blocks) {
        await createBlock.mutateAsync({ pageId: page.id, content: block });
      }

      toast(t('success', { count: parsed.blocks.length }), 'success');
      router.push(`/workspaces/${targetWorkspaceId}/${page.id}`);
    } catch {
      toast(t('failed'));
    } finally {
      setBusy(false);
    }
  }

  const workspaceOptions = workspaces.map((workspace) => ({
    value: workspace.id,
    label: workspace.name,
  }));

  return (
    <div className="flex flex-col gap-10">
      <SettingsGroup title={t('title')} hint={t('hint')}>
        <SettingsRow label={t('target')} hint={t('targetHint')}>
          {list.isPending ? (
            <p className="text-muted-foreground text-sm">{t('loading')}</p>
          ) : workspaces.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('emptyWorkspaces')}</p>
          ) : (
            <SettingsSelect
              label={t('targetLabel')}
              value={targetWorkspaceId ?? ''}
              options={workspaceOptions}
              onValueChange={setWorkspaceId}
              className="w-56"
            />
          )}
        </SettingsRow>

        <SettingsRow
          label={t('file')}
          hint={
            parsed === null
              ? t('hint')
              : `${parsed.filename} · ${t('blocksCount', {
                  count: formatNumber(parsed.blocks.length, preferences),
                })}`
          }
          align="start"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            className="hidden"
            aria-label={t('fileLabel')}
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void readFile(file);
              }

              // The same file can be picked again after an error.
              event.target.value = '';
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={workspaces.length === 0}
          >
            <FileUp data-icon="inline-start" aria-hidden="true" />
            {t('chooseFile')}
          </Button>
        </SettingsRow>

        {parsed ? (
          <div className="flex flex-col gap-3 border-b border-border/70 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{parsed.title}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {parsed.filename} ·{' '}
                {t('blocksCount', {
                  count: formatNumber(parsed.blocks.length, preferences),
                })}
              </p>
            </div>
            <Button onClick={() => void runImport()} disabled={busy}>
              {busy ? t('running') : t('run')}
            </Button>
          </div>
        ) : null}
      </SettingsGroup>
    </div>
  );
}
