'use client';

import { useTranslations } from 'next-intl';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { filterSlashCommands, type SlashCommand } from '../../utils/slash';

export interface SlashMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashMenuProps {
  query: string;
  onSelect: (command: SlashCommand) => void;
  onClose?: () => void;
  /**
   * Suggestion intercepts keys itself and closes the menu on an outside click.
   * For the plus menu we install the same handlers on window.
   */
  keyboard?: boolean;
}

/**
 * Popover slash menu.
 *
 * The query text stays in the document (as in Notion), so there is no separate
 * input here: after `/` the user keeps typing inside the block. The component
 * does not know who opened it: the official Suggestion calls `onKeyDown`,
 * while the plus menu uses the built-in window handlers.
 */
export const SlashMenu = forwardRef<SlashMenuHandle, SlashMenuProps>(function SlashMenu(
  { query, onSelect, onClose, keyboard = true },
  ref,
) {
  const t = useTranslations('editor.slash');
  const tCommon = useTranslations('common');
  const commands = useMemo(() => filterSlashCommands(query), [query]);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const pointerSelected = useRef(false);

  const currentIndex = commands.length === 0 ? 0 : Math.min(activeIndex, commands.length - 1);
  const activeCommand = commands[currentIndex];

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (activeItemRef.current && typeof activeItemRef.current.scrollIntoView === 'function') {
      activeItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [currentIndex]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent): boolean => {
      if (event.isComposing) {
        return false;
      }

      if (event.key === 'Escape' || event.key === 'Esc') {
        onClose?.();
        return true;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (commands.length === 0) {
          return true;
        }

        setActiveIndex((index) => {
          const next = event.key === 'ArrowDown' ? index + 1 : index - 1;

          return (next + commands.length) % commands.length;
        });
        return true;
      }

      if (event.key === 'Enter') {
        if (activeCommand) {
          onSelect(activeCommand);
        }
        return true;
      }

      return false;
    },
    [activeCommand, commands.length, onClose, onSelect],
  );

  // ReactRenderer may keep the ref from the first render. We keep the current
  // handler in a ref so Enter/arrows see the current query and command.
  const handleKeyDownRef = useRef(handleKeyDown);
  handleKeyDownRef.current = handleKeyDown;

  useImperativeHandle(ref, () => ({ onKeyDown: (event) => handleKeyDownRef.current(event) }), []);

  useEffect(() => {
    if (!keyboard) {
      return;
    }

    function handleWindowKeyDown(event: KeyboardEvent) {
      if (handleKeyDown(event)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown, true);

    return () => window.removeEventListener('keydown', handleWindowKeyDown, true);
  }, [handleKeyDown, keyboard]);

  useEffect(() => {
    if (!keyboard || !onClose) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        onClose?.();
      }
    }

    function handleScroll(event: Event) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        menuRef.current.contains(event.target)
      ) {
        return;
      }

      onClose?.();
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [keyboard, onClose]);

  return (
    <div
      ref={menuRef}
      role="listbox"
      aria-label={t('menuLabel')}
      className="bg-popover text-popover-foreground flex max-h-80 w-72 flex-col overflow-hidden rounded-lg border shadow-md"
    >
      <div className="text-muted-foreground shrink-0 border-b px-3 py-2 text-[11px] font-medium tracking-wide uppercase">
        {t('basics')}
      </div>

      {/* Only the command list scrolls: the keyboard hints stay pinned to the
          bottom of the menu however long the filtered list gets. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {commands.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            {tCommon('notFound')}
          </p>
        ) : (
          commands.map((command, index) => {
            const active = index === currentIndex;

            return (
              <button
                key={command.id}
                ref={active ? activeItemRef : undefined}
                type="button"
                role="option"
                aria-selected={active}
                onPointerDown={(event) => {
                  if (event.button > 0) {
                    return;
                  }

                  // We pick the command already on pointerdown: the menu may
                  // unmount before the click event, and the choice would be lost.
                  event.preventDefault();
                  pointerSelected.current = true;
                  onSelect(command);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  // For the mouse the command was already applied on pointerdown.
                  // A click from the keyboard/assistive tech arrives without pointerdown.
                  if (pointerSelected.current) {
                    pointerSelected.current = false;
                    return;
                  }

                  onSelect(command);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                }`}
              >
                <span className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded border font-mono text-xs">
                  {command.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{t(`commands.${command.label}`)}</span>
                {command.markdown ? (
                  <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-[11px]">
                    <kbd className="bg-background rounded border px-1.5 py-0.5 font-mono text-[10px]">
                      {command.markdown}
                    </kbd>
                    <span>Space</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[11px]">—</span>
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="text-muted-foreground flex shrink-0 items-center gap-3 border-t px-3 py-2 text-[11px]">
        <span>↑↓ {t('select')}</span>
        <span>↵ {t('insert')}</span>
        <span>{t('esc')}</span>
      </div>
    </div>
  );
});
