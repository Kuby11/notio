'use client';

import { Boxes, Search, SlidersHorizontal, Upload, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import { useAuth } from '@/modules/auth';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import { useSettingsStore, type SettingsSectionId } from '../../stores/settings.store';
import { Avatar } from '../avatar';
import { ImportSection } from './import-section';
import { PreferencesSection } from './preferences-section';
import { ProfileSection } from './profile-section';
import { WorkspacesSection } from './workspaces-section';

type SettingsGroupId = 'account' | 'workspace';

interface SettingsSection {
  id: SettingsSectionId;
  group: SettingsGroupId;
  icon: ReactNode;
  render: () => ReactNode;
}

/** Workspace for the avatar upload (media requires a workspaceId). */
interface SettingsDialogProps {
  workspaceId: string;
}

const GROUPS: readonly SettingsGroupId[] = ['account', 'workspace'];

/**
 * Settings dialog, as in Notion: a grouped sidebar with search and the sections
 * on the left, a large titled content column on the right with a close button.
 *
 * Search filters sections by title and synonyms; the active section switches to
 * the first match when it itself gets filtered out.
 */
export function SettingsDialog({ workspaceId }: SettingsDialogProps) {
  const t = useTranslations('settings');
  const tSection = useTranslations('settings.sections');
  const tCommon = useTranslations('common');
  const { session } = useAuth();
  const open = useSettingsStore((state) => state.open);
  const close = useSettingsStore((state) => state.close);
  const storedSection = useSettingsStore((state) => state.section);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<SettingsSectionId>(storedSection);

  const user = session.data?.user ?? null;

  const sections: readonly SettingsSection[] = [
    {
      id: 'profile',
      group: 'account',
      icon: <User className="size-4" aria-hidden="true" />,
      render: () => <ProfileSection workspaceId={workspaceId} />,
    },
    {
      id: 'preferences',
      group: 'account',
      icon: <SlidersHorizontal className="size-4" aria-hidden="true" />,
      render: () => <PreferencesSection />,
    },
    {
      id: 'workspaces',
      group: 'workspace',
      icon: <Boxes className="size-4" aria-hidden="true" />,
      render: () => <WorkspacesSection />,
    },
    {
      id: 'import',
      group: 'workspace',
      icon: <Upload className="size-4" aria-hidden="true" />,
      render: () => <ImportSection />,
    },
  ];

  // Reopening the dialog from another place should show the requested section.
  useEffect(() => {
    if (open) {
      setActiveId(storedSection);
    } else {
      setQuery('');
    }
  }, [open, storedSection]);

  const visible = useMemo(
    () =>
      sections.filter((section) =>
        query.trim().length === 0
          ? true
          : [tSection(section.id), section.id].some((value) =>
              value.toLowerCase().includes(query.trim().toLowerCase()),
            ),
      ),
    // tSection is stable between renders of the same language.
    [query, tSection],
  );

  // The active section may have been filtered out by search — show the first visible one.
  const active = visible.find((section) => section.id === activeId) ?? visible[0];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
    >
      <DialogContent
        showCloseButton
        className="flex h-[min(92vh,960px)] w-[min(96vw,1200px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>
        <div className="flex min-h-0 flex-1">
          <aside className="bg-muted/20 flex w-64 shrink-0 flex-col border-r border-border">
            <div className="p-3">
              <div className="bg-muted/60 dark:bg-muted/40 flex h-8 items-center gap-2 rounded-md border border-transparent px-2 transition-colors focus-within:border-ring">
                <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('searchPlaceholder')}
                  aria-label={t('searchPlaceholder')}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label={t('navLabel')}>
              {visible.length === 0 ? (
                <p className="text-muted-foreground px-2 py-1.5 text-sm">{tCommon('notFound')}</p>
              ) : (
                GROUPS.map((group) => {
                  const items = visible.filter(
                    (section) => section.group === group && section.id !== 'profile',
                  );
                  const showUser =
                    group === 'account' &&
                    user !== null &&
                    (query.trim().length === 0 ||
                      visible.some((section) => section.id === 'profile'));

                  if (items.length === 0 && !showUser) {
                    return null;
                  }

                  return (
                    <div key={group} className="flex flex-col">
                      <p className="text-muted-foreground px-2 pt-3 pb-1 text-xs font-medium">
                        {t(`groups.${group}`)}
                      </p>

                      {showUser ? (
                        <button
                          type="button"
                          onClick={() => setActiveId('profile')}
                          aria-current={active?.id === 'profile' ? 'true' : undefined}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                            active?.id === 'profile'
                              ? 'bg-muted text-foreground'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )}
                        >
                          <Avatar name={user.name} src={user.image} size="sm" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {user.name || t('profile.noName')}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {user.email}
                            </span>
                          </span>
                        </button>
                      ) : null}

                      {items.map((section) => (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => setActiveId(section.id)}
                          aria-current={section.id === active?.id ? 'true' : undefined}
                          className={cn(
                            'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors',
                            section.id === active?.id
                              ? 'bg-muted font-medium text-foreground'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )}
                        >
                          {section.icon}
                          {tSection(section.id)}
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </nav>
          </aside>

          <div className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-10 py-8">
              {active ? (
                <section key={active.id} aria-labelledby={`settings-${active.id}`}>
                  <header className="mb-8">
                    <h1
                      id={`settings-${active.id}`}
                      className="text-2xl font-semibold tracking-tight"
                    >
                      {tSection(active.id)}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {tSection(`${active.id}Hint`)}
                    </p>
                  </header>
                  {active.render()}
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
