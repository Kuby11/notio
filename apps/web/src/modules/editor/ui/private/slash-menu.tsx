'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { filterSlashCommands, type SlashCommand } from '../../utils/slash';

export interface SlashMenuPosition {
  top: number;
  left: number;
}

interface SlashMenuProps {
  query: string;
  position: SlashMenuPosition | null;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}

/**
 * Popover slash-меню.
 *
 * Текст запроса остаётся в документе (как в Notion), поэтому отдельного
 * input здесь нет: после `/` пользователь продолжает печатать в блоке.
 * Стрелки, Enter и Escape перехватываются в capture-фазе, чтобы ProseMirror
 * не переместил курсор под открытым меню.
 */
export function SlashMenu({ query, position, onSelect, onClose }: SlashMenuProps) {
  const commands = useMemo(() => filterSlashCommands(query), [query]);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();

        if (commands.length === 0) {
          return;
        }

        setActiveIndex((index) => {
          const next = event.key === 'ArrowDown' ? index + 1 : index - 1;

          return (next + commands.length) % commands.length;
        });
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();

        if (activeCommand) {
          onSelect(activeCommand);
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);

    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeCommand, commands.length, onClose, onSelect]);

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
      if (
        menuRef.current &&
        event.target instanceof Node &&
        menuRef.current.contains(event.target)
      ) {
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

  if (!position) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      role="listbox"
      aria-label="Вставить блок"
      className="bg-popover text-popover-foreground fixed z-50 w-80 overflow-hidden rounded-lg border shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="text-muted-foreground border-b px-3 py-2 text-[11px] font-medium tracking-wide uppercase">
        Базовые блоки
      </div>

      <div className="max-h-[340px] overflow-y-auto p-1">
        {commands.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">Ничего не найдено</p>
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
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelect(command)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                  active ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                }`}
              >
                <span className="bg-muted text-muted-foreground flex h-7 w-7 shrink-0 items-center justify-center rounded border font-mono text-xs">
                  {command.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
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

      <div className="text-muted-foreground flex items-center gap-3 border-t px-3 py-2 text-[11px]">
        <span>↑↓ выбрать</span>
        <span>↵ вставить</span>
        <span>Esc закрыть</span>
      </div>
    </div>
  );
}
