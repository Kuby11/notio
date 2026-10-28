'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import type { BlockColorPreset } from '@notio/contracts';
import { HttpUrlSchema } from '@notio/contracts';
import type { Editor } from '@tiptap/react';
import { cn } from 'cn';
import { Bold, Code, Highlighter, Italic, Link2, Palette, Strikethrough } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { toast } from '@/shared/ui/toast';
import { COLOR_PRESETS, COLOR_SWATCHES } from '../../utils/palette';

interface TextBubbleMenuProps {
  editor: Editor;
}

/** The floating menu is anchored to the current text selection, not to a DOM node. */
interface SelectionAnchor {
  getBoundingClientRect: () => DOMRect;
  contextElement: Element;
}

/** Empty rect for environments without Range geometry (jsdom). */
function emptyRect(): DOMRect {
  return document.createElement('div').getBoundingClientRect();
}

/** Bounding rect of the current selection, in viewport coordinates. */
function selectionRect(editor: Editor): DOMRect {
  const { from, to } = editor.state.selection;

  if (from === to) {
    return emptyRect();
  }

  const start = editor.view.domAtPos(from);
  const end = editor.view.domAtPos(to);
  const range = document.createRange();

  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);

  // jsdom implements Range but not its layout geometry.
  return typeof range.getBoundingClientRect === 'function'
    ? range.getBoundingClientRect()
    : emptyRect();
}

const BUBBLE_BUTTON_CLASS =
  'inline-flex size-7 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground';

/** Icon button of the bubble menu with a shadcn tooltip instead of a native title. */
function BubbleButton({
  label,
  active,
  expanded,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            aria-pressed={active}
            aria-expanded={expanded}
            // Keep ProseMirror focused: the selection must survive the click.
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
            className={cn(BUBBLE_BUTTON_CLASS, active && 'bg-accent text-accent-foreground')}
          >
            {children}
          </button>
        }
      />
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Bubble menu over the selected text: bold, italic, strikethrough, code,
 * link and text/background colours. Built on the same Base UI Popover
 * primitive as shadcn's `Popover`, anchored to the text selection itself.
 *
 * Not shown over an empty selection, code blocks or selected atomic nodes.
 */
export function TextBubbleMenu({ editor }: TextBubbleMenuProps) {
  const t = useTranslations('editor.bubble');
  const tColors = useTranslations('editor.colors');
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [paletteOpen, setPaletteOpen] = useState<'color' | 'backgroundColor' | null>(null);
  const keepOpenRef = useRef(false);

  keepOpenRef.current = linkOpen || paletteOpen !== null;

  const anchor = useMemo<SelectionAnchor>(
    () => ({
      getBoundingClientRect: () => selectionRect(editor),
      contextElement: editor.view.dom,
    }),
    [editor],
  );

  useEffect(() => {
    const update = () => {
      const { selection } = editor.state;
      const selected =
        editor.isEditable &&
        !selection.empty &&
        !editor.isActive('codeBlock') &&
        selection.$from.sameParent(selection.$to);

      if (!selected) {
        // Keep the menu while one of its own panels owns the focus.
        if (!keepOpenRef.current) {
          setOpen(false);
          setLinkOpen(false);
          setPaletteOpen(null);
        }

        return;
      }

      if (!editor.isFocused && !keepOpenRef.current) {
        setOpen(false);
        return;
      }

      setOpen(true);
    };

    const closeOnBlur = () => {
      if (!keepOpenRef.current) {
        setOpen(false);
        setPaletteOpen(null);
      }
    };

    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    editor.on('focus', update);
    editor.on('blur', closeOnBlur);
    update();

    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
      editor.off('focus', update);
      editor.off('blur', closeOnBlur);
    };
  }, [editor]);

  // Closing the link panel while the editor is blurred must close the menu too.
  useEffect(() => {
    if (open && !linkOpen && paletteOpen === null && !editor.isFocused) {
      setOpen(false);
    }
  }, [open, linkOpen, paletteOpen, editor]);

  function toggleMark(mark: 'bold' | 'italic' | 'strike' | 'code'): void {
    const chain = editor.chain().focus();

    if (mark === 'bold') {
      chain.toggleBold();
    } else if (mark === 'italic') {
      chain.toggleItalic();
    } else if (mark === 'strike') {
      chain.toggleStrike();
    } else {
      chain.toggleCode();
    }

    chain.run();
  }

  function applyLink(): void {
    const href = linkValue.trim();
    const parsed = HttpUrlSchema.safeParse(href);

    if (!parsed.success) {
      toast(t('linkInvalid'), 'error');
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: parsed.data }).run();
    setLinkOpen(false);
    setLinkValue('');
  }

  function removeLink(): void {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
    setLinkValue('');
  }

  function setColor(kind: 'color' | 'backgroundColor', preset: BlockColorPreset | null): void {
    const markName = kind === 'color' ? 'textColor' : 'textBg';

    if (preset === null || editor.isActive(markName, { color: preset })) {
      editor.chain().focus().unsetMark(markName).run();
    } else {
      editor.chain().focus().setMark(markName, { color: preset }).run();
    }

    setPaletteOpen(null);
  }

  function closeAll(): void {
    setOpen(false);
    setLinkOpen(false);
    setPaletteOpen(null);
    editor.commands.focus();
  }

  return (
    <Popover open={open} modal={false} onOpenChange={() => undefined}>
      {/*
        Anchor-only trigger: the popover is fully controlled by `open`, and positioning comes
        from the `anchor` prop below, so the trigger never needs to be clicked. It stays a plain
        span (not a button): `nativeButton={false}` must match the non-<button> render, or
        Base UI warns about the mismatch in either direction.
      */}
      <PopoverTrigger nativeButton={false} render={<span />} tabIndex={-1} aria-hidden="true">
        <span style={{ position: 'absolute', left: -9999, top: 0 }} />
      </PopoverTrigger>
      <PopoverContent
        anchor={anchor}
        side="top"
        align="center"
        sideOffset={10}
        data-slot="popover-content"
        initialFocus={false}
        finalFocus={false}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeAll();
          }
        }}
        className="z-50 flex w-fit origin-(--transform-origin) flex-col rounded-lg bg-popover p-1 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
      >
        <div className="flex items-center gap-0.5 p-1" onClick={(event) => event.stopPropagation()}>
          <BubbleButton
            label={t('bold')}
            active={editor.isActive('bold')}
            onClick={() => toggleMark('bold')}
          >
            <Bold className="size-4" aria-hidden="true" />
          </BubbleButton>
          <BubbleButton
            label={t('italic')}
            active={editor.isActive('italic')}
            onClick={() => toggleMark('italic')}
          >
            <Italic className="size-4" aria-hidden="true" />
          </BubbleButton>
          <BubbleButton
            label={t('strike')}
            active={editor.isActive('strike')}
            onClick={() => toggleMark('strike')}
          >
            <Strikethrough className="size-4" aria-hidden="true" />
          </BubbleButton>
          <BubbleButton
            label={t('code')}
            active={editor.isActive('code')}
            onClick={() => toggleMark('code')}
          >
            <Code className="size-4" aria-hidden="true" />
          </BubbleButton>
          <Popover
            open={linkOpen}
            onOpenChange={(next) => {
              if (next) {
                const attrs = editor.getAttributes('link');

                setLinkValue(typeof attrs['href'] === 'string' ? attrs['href'] : '');
              }

              setLinkOpen(next);
            }}
          >
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={t('link')}
                  aria-expanded={linkOpen}
                  aria-pressed={editor.isActive('link')}
                  onMouseDown={(event) => event.preventDefault()}
                  className={cn(
                    BUBBLE_BUTTON_CLASS,
                    editor.isActive('link') && 'bg-accent text-accent-foreground',
                  )}
                >
                  <Link2 className="size-4" aria-hidden="true" />
                </button>
              }
            />
            <PopoverContent
              side="bottom"
              align="center"
              sideOffset={8}
              className="w-auto p-1.5"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-1.5">
                <Input
                  type="url"
                  autoFocus
                  placeholder="https://…"
                  value={linkValue}
                  onChange={(event) => setLinkValue(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();

                    if (event.key === 'Enter') {
                      event.preventDefault();
                      applyLink();
                    }

                    if (event.key === 'Escape') {
                      setLinkOpen(false);
                      editor.commands.focus();
                    }
                  }}
                  className="h-7 w-56 text-[13px]"
                  aria-label={t('link')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={applyLink}
                >
                  {t('applyLink')}
                </Button>
                {editor.isActive('link') ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-7 px-2 text-xs"
                    onClick={removeLink}
                  >
                    {t('removeLink')}
                  </Button>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
          <BubbleButton
            label={t('textColor')}
            expanded={paletteOpen === 'color'}
            onClick={() => setPaletteOpen((value) => (value === 'color' ? null : 'color'))}
          >
            <Palette className="size-4" aria-hidden="true" />
          </BubbleButton>
          <BubbleButton
            label={t('background')}
            expanded={paletteOpen === 'backgroundColor'}
            onClick={() =>
              setPaletteOpen((value) => (value === 'backgroundColor' ? null : 'backgroundColor'))
            }
          >
            <Highlighter className="size-4" aria-hidden="true" />
          </BubbleButton>
        </div>

        {paletteOpen !== null ? (
          <div className="flex max-w-48 flex-wrap items-center gap-1 border-t border-border p-1.5">
            {COLOR_PRESETS.map((preset) => (
              <Tooltip key={preset}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`${paletteOpen === 'color' ? t('textColor') : t('background')}: ${tColors(preset)}`}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setColor(paletteOpen, preset)}
                      style={{ backgroundColor: COLOR_SWATCHES[preset].hex }}
                      className="size-5 rounded border border-black/15"
                    />
                  }
                />
                <TooltipContent side="bottom">{COLOR_SWATCHES[preset].name}</TooltipContent>
              </Tooltip>
            ))}
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label={t('resetColor')}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setColor(paletteOpen, null)}
                    className="inline-flex size-5 items-center justify-center rounded border border-border text-[11px] font-medium"
                  >
                    A
                  </button>
                }
              />
              <TooltipContent side="bottom">{t('resetColor')}</TooltipContent>
            </Tooltip>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
