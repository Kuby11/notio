'use client';

import { ArrowLeft, Check, Copy, Download, Palette, RefreshCw, Replace, Trash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { BlockColorPreset } from '@notio/contracts';
import { COLOR_PRESETS as COLOR_PRESET_KEYS, COLOR_SWATCHES } from '../../utils/palette';
import type { TurnIntoOption } from '../../utils/block-actions';

const COLOR_PRESETS = COLOR_PRESET_KEYS;

interface BlockActionsMenuProps {
  canTurnInto: boolean;
  canColor: boolean;
  /** Turn-into targets depend on the block: an image offers only the file. */
  turnIntoOptions: readonly TurnIntoOption[];
  /** Id of the current type in turnIntoOptions — for the check in the list. */
  currentTurnIntoId: string | null;
  currentColor: BlockColorPreset | null;
  currentBackground: BlockColorPreset | null;
  /** Source replacement (image) and download — for media blocks. */
  canReplace: boolean;
  canDownload: boolean;
  onTurnInto: (option: TurnIntoOption) => void;
  onSetColor: (color: BlockColorPreset | null) => void;
  onSetBackground: (background: BlockColorPreset | null) => void;
  onReplace: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

type MenuView = 'actions' | 'turn-into' | 'color';

/**
 * Block action menu on the drag handle.
 *
 * Popover with fixed positions: the main list, the nested "Turn into" and
 * "Colour" lists. Escape closes the menu, arrow keys move focus between the
 * buttons — the navigation also works from the keyboard.
 */
export function BlockActionsMenu({
  canTurnInto,
  canColor,
  turnIntoOptions,
  currentTurnIntoId,
  currentColor,
  currentBackground,
  canReplace,
  canDownload,
  onTurnInto,
  onSetColor,
  onSetBackground,
  onReplace,
  onDownload,
  onDelete,
  onDuplicate,
  onClose,
}: BlockActionsMenuProps) {
  const t = useTranslations('editor.blockActions');
  const [view, setView] = useState<MenuView>('actions');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        onClose();
      }
    }

    function handleScroll(event: Event) {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) {
        return;
      }

      onClose();
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  // Arrow keys move focus across the buttons of the current view; Enter fires on its own.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.isComposing) {
        return;
      }

      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }

      const buttons = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
      ).filter((button) => button.offsetParent !== null);

      if (buttons.length === 0) {
        return;
      }

      event.preventDefault();

      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = buttons[(currentIndex + delta + buttons.length) % buttons.length];

      next?.focus();
    }

    window.addEventListener('keydown', handleKeyDown, true);

    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t('menuLabel')}
      className="w-72 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
    >
      {view === 'actions' ? (
        <div className="p-1" role="group">
          {canReplace && (
            <ActionRow
              icon={<RefreshCw className="size-4" aria-hidden="true" />}
              label={t('replace')}
              onClick={onReplace}
            />
          )}
          {canTurnInto && turnIntoOptions.length > 0 && (
            <ActionRow
              icon={<Replace className="size-4" aria-hidden="true" />}
              label={t('turnInto')}
              onClick={() => setView('turn-into')}
            />
          )}
          {canDownload && (
            <ActionRow
              icon={<Download className="size-4" aria-hidden="true" />}
              label={t('download')}
              onClick={onDownload}
            />
          )}
          {canColor && (
            <ActionRow
              icon={<Palette className="size-4" aria-hidden="true" />}
              label={t('color')}
              onClick={() => setView('color')}
            />
          )}
          <ActionRow
            icon={<Copy className="size-4" aria-hidden="true" />}
            label={t('duplicate')}
            onClick={onDuplicate}
          />
          <ActionRow
            icon={<Trash className="size-4" aria-hidden="true" />}
            label={t('delete')}
            tone="destructive"
            onClick={onDelete}
          />
        </div>
      ) : null}

      {view === 'turn-into' ? (
        <div role="group" aria-label={t('turnInto')}>
          <MenuHeader title={t('turnInto')} onBack={() => setView('actions')} />
          <div className="max-h-[320px] overflow-y-auto p-1">
            {turnIntoOptions.map((option) => {
              const active = option.id === currentTurnIntoId;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  onClick={() => onTurnInto(option)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    active ? 'bg-accent/60' : 'hover:bg-accent/60'
                  }`}
                >
                  <span className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded border font-mono text-xs">
                    {option.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {t(`turnIntoOption.${option.id}`)}
                  </span>
                  {active ? (
                    <Check className="text-muted-foreground size-4" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === 'color' ? (
        <div role="group" aria-label={t('blockColor')}>
          <MenuHeader title={t('color')} onBack={() => setView('actions')} />
          <ColorSection title={t('textColor')} current={currentColor} onSelect={onSetColor} />
          <ColorSection
            title={t('background')}
            current={currentBackground}
            onSelect={onSetBackground}
          />
        </div>
      ) : null}
    </div>
  );
}

interface ActionRowProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'default' | 'destructive';
}

function ActionRow({ icon, label, onClick, tone = 'default' }: ActionRowProps) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent/60 ${
        tone === 'destructive' ? 'text-destructive' : ''
      }`}
    >
      <span className="flex w-4 shrink-0 justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function MenuHeader({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useTranslations('editor.blockActions');

  return (
    <div className="text-muted-foreground flex items-center gap-1 border-b px-1 py-1 text-[11px] font-medium tracking-wide uppercase">
      <button
        type="button"
        aria-label={t('backToActions')}
        onClick={onBack}
        className="hover:bg-accent flex size-6 items-center justify-center rounded transition-colors"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
      </button>
      <span>{title}</span>
    </div>
  );
}

interface ColorSectionProps {
  title: string;
  current: BlockColorPreset | null;
  onSelect: (preset: BlockColorPreset | null) => void;
}

/** Group of colour swatches: reset plus the nine palette presets. */
function ColorSection({ title, current, onSelect }: ColorSectionProps) {
  const t = useTranslations('editor.blockActions');
  const tColors = useTranslations('editor.colors');
  return (
    <div className="border-b p-2 last:border-b-0">
      <p className="text-muted-foreground mb-1.5 px-1 text-[11px] font-medium tracking-wide uppercase">
        {title}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-label={`${title}: ${t('resetColor')}`}
          aria-pressed={current === null}
          onClick={() => onSelect(null)}
          className={`flex h-6 w-6 items-center justify-center rounded border text-[10px] transition-transform hover:scale-110 ${
            current === null ? 'ring-foreground ring-2' : ''
          }`}
        >
          <span aria-hidden="true">A</span>
        </button>
        {COLOR_PRESETS.map((preset) => {
          const swatch = COLOR_SWATCHES[preset];
          const active = current === preset;

          return (
            <button
              key={preset}
              type="button"
              title={tColors(preset)}
              aria-label={`${title}: ${tColors(preset)}`}
              aria-pressed={active}
              onClick={() => onSelect(preset)}
              className={`h-6 w-6 rounded border transition-transform hover:scale-110 ${
                active ? 'ring-foreground ring-2' : ''
              }`}
              style={{ backgroundColor: swatch.hex }}
            />
          );
        })}
      </div>
    </div>
  );
}
