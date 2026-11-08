'use client';

import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { FileText, Link, Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MediaLightbox } from './media-lightbox';
import { HttpUrlSchema } from '@notio/contracts';
import { toast } from '../../../../shared/ui/toast';
import { mediaBridge } from '../../utils/media-bridge';
import { IMAGE_WIDTH_MAX, resizeImage, resizeImageByKeyboard } from '../../utils/image-resize';
import { formatBytes } from '../../../media';

/**
 * Media block node views: image, video, file, emoji.
 *
 * An empty block shows the upload card (local file or link), a filled one
 * shows the media itself. Network and URLs come through the bridge
 * (utils/media-bridge), limit errors arrive as toasts from useMedia. Fields
 * inside a node view swallow keyboard events, otherwise ProseMirror would
 * intercept input into them.
 */

/** Input event stubs: inputs inside a node view must not reach PM. */
const inputStopEvents = {
  onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation(),
  onKeyUp: (event: React.KeyboardEvent) => event.stopPropagation(),
  onKeyPress: (event: React.KeyboardEvent) => event.stopPropagation(),
  onClick: (event: React.MouseEvent) => event.stopPropagation(),
};

interface PlaceholderProps {
  titleKey: string;
  accept: string;
  busy: boolean;
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
  /** Cancel button: shown when replacing an existing source. */
  onCancel?: () => void;
}

function MediaPlaceholder({ titleKey, accept, busy, onFile, onUrl, onCancel }: PlaceholderProps) {
  const t = useTranslations('editor.media');
  const tCommon = useTranslations('common');
  const [link, setLink] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const title = t(titleKey);

  return (
    <NodeViewWrapper as="div" className="notio-media-placeholder" data-title={title}>
      <p className="notio-media-placeholder-title">{busy ? tCommon('loading') : title}</p>
      <div className="notio-media-placeholder-actions">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];

            if (file) {
              onFile(file);
            }

            event.target.value = '';
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          className="notio-media-button"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          {t('chooseFile')}
        </button>
        <span className="notio-media-or">{t('orLink')}</span>
        <span className="notio-media-link-row">
          <Link className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
          <input
            type="url"
            placeholder={t('linkPlaceholder')}
            value={link}
            disabled={busy}
            onChange={(event) => setLink(event.target.value)}
            onKeyDown={(event) => {
              event.stopPropagation();

              if (event.key === 'Enter') {
                event.preventDefault();
                onUrl(link.trim());
                setLink('');
              }
            }}
            className="notio-media-link-input"
          />
        </span>
        <button
          type="button"
          disabled={busy || link.trim().length === 0}
          onClick={() => {
            onUrl(link.trim());
            setLink('');
          }}
          className="notio-media-button"
        >
          {t('insertLink')}
        </button>
        {onCancel ? (
          <button type="button" disabled={busy} onClick={onCancel} className="notio-media-button">
            {tCommon('cancel')}
          </button>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

/** Validates a media link: http(s) only, otherwise a toast and a refusal. */
function validMediaUrl(raw: string): string | null {
  const result = HttpUrlSchema.safeParse(raw);

  if (!result.success) {
    return null;
  }

  return result.data;
}

interface MediaState {
  fileId: string | null;
  url: string | null;
}

function mediaStateOf(node: ReactNodeViewProps['node']): MediaState {
  const fileId = node.attrs['fileId'];
  const url = node.attrs['url'];

  return {
    fileId: typeof fileId === 'string' && fileId.length > 0 ? fileId : null,
    url: typeof url === 'string' && url.length > 0 ? url : null,
  };
}

/** Shared upload logic for image/video/file: true — the file was uploaded. */
function useMediaUpload(
  editor: ReactNodeViewProps['editor'],
  updateAttributes: ReactNodeViewProps['updateAttributes'],
  kind: 'image' | 'video' | 'file',
) {
  const [busy, setBusy] = useState(false);

  async function uploadFile(file: File): Promise<boolean> {
    setBusy(true);

    const meta = await mediaBridge(editor).uploadFile(file, kind);

    setBusy(false);

    if (meta) {
      updateAttributes({ fileId: meta.id, url: null });
      return true;
    }

    return false;
  }

  return { busy, uploadFile };
}

/** Applies the link; false — invalid link (the view shows a toast). */
function applyUrl(updateAttributes: ReactNodeViewProps['updateAttributes'], raw: string): boolean {
  const url = validMediaUrl(raw);

  if (!url) {
    return false;
  }

  updateAttributes({ url, fileId: null });
  return true;
}

/** Silences the native event: ProseMirror must not see it. */
function stopPropagationEvent(nativeEvent: Event): void {
  nativeEvent.stopPropagation();
  nativeEvent.preventDefault();
}

/** Silences mousedown/dblclick from ProseMirror: the handle must not select the node. */
function stopNativeEvents(element: HTMLSpanElement | null): () => void {
  if (element === null) {
    return () => undefined;
  }

  element.addEventListener('mousedown', stopPropagationEvent);
  element.addEventListener('dblclick', stopPropagationEvent);

  return () => {
    element.removeEventListener('mousedown', stopPropagationEvent);
    element.removeEventListener('dblclick', stopPropagationEvent);
  };
}

export function ImageView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  const t = useTranslations('editor.media');
  const tResize = useTranslations('editor.imageResize');
  const { fileId, url } = mediaStateOf(node);
  const caption = typeof node.attrs['caption'] === 'string' ? node.attrs['caption'] : '';
  const width = typeof node.attrs['width'] === 'number' ? node.attrs['width'] : null;
  const wideWidth = typeof node.attrs['wideWidth'] === 'number' ? node.attrs['wideWidth'] : null;
  const fullWidth = node.attrs['fullWidth'] === true;
  const replacing = node.attrs['replacing'] === true;
  const { busy, uploadFile } = useMediaUpload(editor, updateAttributes, 'image');
  const src = fileId ? mediaBridge(editor).fileUrl(fileId) : url;
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // While dragging the handle: the side, the pinned edge (px from the column) and
  // the column width. They keep the opposite edge from moving during the drag.
  const [resizing, setResizing] = useState<{
    side: 'left' | 'right';
    anchorPx: number;
    columnWidth: number;
  } | null>(null);

  const figureRef = useRef<HTMLElement | null>(null);

  // Measured geometry of the breakout modes (full-width and wide): the
  // container's width and the column's offset from it. Recomputed on window
  // and sidebar resize.
  const [bleed, setBleed] = useState<{
    containerWidth: number;
    containerLeft: number;
    columnLeft: number;
  } | null>(null);

  const breakout = fullWidth || wideWidth !== null;

  useEffect(() => {
    if (!breakout) {
      setBleed(null);

      return;
    }

    const column = figureRef.current?.closest('.ProseMirror');
    const container = figureRef.current?.closest('[data-editor-container]');

    if (!(column instanceof HTMLElement) || !(container instanceof HTMLElement)) {
      return;
    }

    const measure = () => {
      const columnRect = column.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      setBleed({
        containerWidth: containerRect.width,
        containerLeft: containerRect.left,
        columnLeft: columnRect.left,
      });
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(container);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [breakout]);

  /**
   * Resize by the side handle, as in Notion, in three states: drag inside the
   * column — a percent of it; past the column edge — wide (a percent of the
   * container, centred, natural aspect); past the container edge — full-width
   * (16:9). Dragging back walks the states in reverse.
   */
  function startResize(event: React.PointerEvent<HTMLSpanElement>, side: 'left' | 'right'): void {
    // Resize handles do not work on a locked page.
    if (event.button !== 0 || !editor.isEditable) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const column = figureRef.current?.closest('.ProseMirror');
    const columnBox = column?.getBoundingClientRect();

    if (!columnBox || columnBox.width === 0) {
      return;
    }

    const columnRect = {
      left: columnBox.left,
      right: columnBox.right,
      width: columnBox.width,
    };
    const container = figureRef.current?.closest('[data-editor-container]');
    const containerBox = container?.getBoundingClientRect();

    if (!containerBox || containerBox.width === 0) {
      return;
    }

    const containerRect = {
      left: containerBox.left,
      right: containerBox.right,
      width: containerBox.width,
    };
    const startState = { fullWidth, width, wideWidth };

    // Pinned edge: for the right handle it is the figure's left edge, for the left one —
    // the right. The width is computed absolutely from it, so the image grows
    // from its actual size (including the natural one) and the edge under
    // the cursor follows it exactly.
    const figureBox = figureRef.current?.getBoundingClientRect();

    if (!figureBox) {
      return;
    }

    const anchorPx =
      side === 'right' ? figureBox.left - columnRect.left : figureBox.right - columnRect.left;

    function onMove(moveEvent: PointerEvent): void {
      const next = resizeImage({
        side,
        clientX: moveEvent.clientX,
        state: startState,
        column: columnRect,
        container: containerRect,
        anchorPx,
      });

      // All three attributes explicitly: the state machine switches between
      // them, a stale value would keep the old state rendering.
      updateAttributes({
        fullWidth: next.fullWidth,
        width: next.width,
        wideWidth: next.wideWidth,
      });
    }

    function onUp(): void {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.classList.remove('notio-image-resizing');
      setResizing(null);
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.body.classList.add('notio-image-resizing');
    setResizing({ side, anchorPx, columnWidth: columnRect.width });
  }

  /** Keyboard resize: arrow keys change the percentage in steps of 5. */
  function resizeByKeyboard(event: React.KeyboardEvent, side: 'left' | 'right'): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const columnBox = figureRef.current?.closest('.ProseMirror')?.getBoundingClientRect();
    const containerBox = figureRef.current
      ?.closest('[data-editor-container]')
      ?.getBoundingClientRect();
    const next = resizeImageByKeyboard({
      side,
      key: event.key,
      state: { fullWidth, width, wideWidth },
      ...(columnBox && containerBox && containerBox.width > 0
        ? { containerRatio: containerBox.width / columnBox.width }
        : {}),
    });

    updateAttributes({
      fullWidth: next.fullWidth,
      width: next.width,
      wideWidth: next.wideWidth,
    });
  }

  // Source replacement: a card over the block, attrs stay until cancelled.
  if (replacing) {
    return (
      <MediaPlaceholder
        titleKey="replaceImage"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
        busy={busy}
        onFile={uploadFile}
        onUrl={(link) => {
          if (!applyUrl(updateAttributes, link)) {
            toast(t('linkInvalid'), 'error');
          }
        }}
        onCancel={() => updateAttributes({ replacing: false })}
      />
    );
  }

  if (!src) {
    return (
      <MediaPlaceholder
        titleKey="image"
        accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
        busy={busy}
        onFile={uploadFile}
        onUrl={(link) => {
          if (!applyUrl(updateAttributes, link)) {
            toast(t('linkInvalid'), 'error');
          }
        }}
      />
    );
  }

  // While dragging we pin the edge opposite the handle: width
  // in px from attrs (they update on every cursor move), the offset stays
  // fixed. After release the figure is centred by margins again.
  // The wide mode is centred symmetrically instead — the bleed style below
  // already follows the attrs, no pinning is needed.
  const resizeStyle =
    resizing && wideWidth === null
      ? {
          width: `${((width ?? IMAGE_WIDTH_MAX) / 100) * resizing.columnWidth}px`,
          ...(resizing.side === 'right'
            ? { marginLeft: `${resizing.anchorPx}px`, marginRight: '0px' }
            : { marginRight: `${resizing.columnWidth - resizing.anchorPx}px`, marginLeft: '0px' }),
        }
      : null;

  const wide = wideWidth !== null && !fullWidth;
  const wideStyle =
    wide && bleed
      ? (() => {
          const pxWidth = (wideWidth / 100) * bleed.containerWidth;
          // Centred in the container: the column offset plus half of the
          // leftover width on each side.
          const margin =
            bleed.containerLeft - bleed.columnLeft + (bleed.containerWidth - pxWidth) / 2;

          return { width: `${pxWidth}px`, marginLeft: `${margin}px` };
        })()
      : null;

  const wrapperStyle = fullWidth
    ? bleed
      ? {
          width: `${bleed.containerWidth}px`,
          marginLeft: `${bleed.containerLeft - bleed.columnLeft}px`,
        }
      : undefined
    : (wideStyle ?? resizeStyle ?? (width !== null ? { width: `${width}%` } : undefined));

  // Explicit width (resize) or a breakout mode: the image fills the frame
  // entirely. Without it the figure hugs the image's natural size.
  const hasExplicitWidth = fullWidth || wide || width !== null;

  return (
    <NodeViewWrapper
      as="figure"
      className={`notio-image${fullWidth ? ' is-full-width' : ''}${wide ? ' is-wide' : ''}${hasExplicitWidth ? ' has-width' : ''}`}
      style={wrapperStyle}
    >
      {/*
        Zero-width text anchor before the image: Chromium only places the caret
        after replaced elements, and without it posAtCoords over the image always
        yields an "after" position — the DragHandle cannot find the block. The
        anchor gives a caret candidate at the left edge.
      */}
      <span className="notio-caret-anchor" aria-hidden="true">
        {'​'}
      </span>
      <span ref={figureRef as React.Ref<HTMLElement>} className="notio-image-frame">
        <img
          src={src}
          alt={caption || t('image')}
          draggable={false}
          onDoubleClick={(event) => {
            event.stopPropagation();
            setLightboxOpen(true);
          }}
        />
        {(['left', 'right'] as const).map((side) => (
          <span
            key={side}
            ref={stopNativeEvents}
            role="button"
            tabIndex={0}
            aria-label={side === 'right' ? tResize('resize') : tResize('resizeOther')}
            title={tResize('hint')}
            onPointerDown={(event) => startResize(event, side)}
            onKeyDown={(event) => resizeByKeyboard(event, side)}
            className={`notio-image-resize-handle notio-image-resize-handle--${side}`}
          />
        ))}
        {resizing ? (
          <span className="notio-image-size-tooltip">
            {fullWidth
              ? tResize('fullWidth')
              : wide
                ? `${wideWidth}%`
                : `${width ?? IMAGE_WIDTH_MAX}%`}
          </span>
        ) : null}
      </span>
      <input
        type="text"
        value={caption}
        placeholder={t('captionOptional')}
        onChange={(event) => updateAttributes({ caption: event.target.value })}
        className="notio-media-caption"
        {...inputStopEvents}
      />
      {lightboxOpen
        ? createPortal(
            <MediaLightbox
              src={src}
              alt={caption || t('image')}
              downloadUrl={fileId ? mediaBridge(editor).fileUrl(fileId, true) : src}
              onClose={() => setLightboxOpen(false)}
            />,
            document.body,
          )
        : null}
    </NodeViewWrapper>
  );
}

export function VideoView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  const t = useTranslations('editor.media');
  const { fileId, url } = mediaStateOf(node);
  const caption = typeof node.attrs['caption'] === 'string' ? node.attrs['caption'] : '';
  const { busy, uploadFile } = useMediaUpload(editor, updateAttributes, 'video');
  const src = fileId ? mediaBridge(editor).fileUrl(fileId) : url;

  if (!src) {
    return (
      <MediaPlaceholder
        titleKey="video"
        accept="video/mp4,video/webm"
        busy={busy}
        onFile={uploadFile}
        onUrl={(link) => {
          if (!applyUrl(updateAttributes, link)) {
            toast(t('linkInvalid'), 'error');
          }
        }}
      />
    );
  }

  return (
    <NodeViewWrapper as="figure" className="notio-video">
      <video src={src} controls preload="metadata" />
      <input
        type="text"
        value={caption}
        placeholder={t('captionOptional')}
        onChange={(event) => updateAttributes({ caption: event.target.value })}
        className="notio-media-caption"
        {...inputStopEvents}
      />
    </NodeViewWrapper>
  );
}

/** Placeholder names: they can be replaced by the real name from the HEAD response. */
const GENERIC_FILE_NAMES = new Set(['Файл', 'Изображение', 'File', 'Image']);

/** File name from the content-disposition header (filename*=UTF-8''…). */
function fileNameFromDisposition(header: string | null): string | null {
  if (header === null) {
    return null;
  }

  const extended = /filename\*=UTF-8''([^;]+)/iu.exec(header);
  const plain = /filename="([^"]+)"/iu.exec(header);
  const raw = extended?.[1] ?? plain?.[1];

  if (raw === undefined) {
    return null;
  }

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function FileView({ node, editor, updateAttributes }: ReactNodeViewProps) {
  const t = useTranslations('editor.media');
  const tSize = useTranslations('media.size');
  const { fileId, url } = mediaStateOf(node);
  const name = typeof node.attrs['name'] === 'string' ? node.attrs['name'] : t('file');
  const sizeBytes = typeof node.attrs['sizeBytes'] === 'number' ? node.attrs['sizeBytes'] : null;
  const { busy, uploadFile } = useMediaUpload(editor, updateAttributes, 'file');
  const bridge = mediaBridge(editor);

  function handleUpload(file: File): void {
    void (async () => {
      const uploaded = await uploadFile(file);

      if (uploaded) {
        updateAttributes({ name: file.name, sizeBytes: file.size });
      }
    })();
  }

  const sourceUrl = fileId !== null ? bridge.fileUrl(fileId) : url;

  useEffect(() => {
    if (
      sourceUrl === null ||
      sourceUrl === '' ||
      (sizeBytes !== null && !GENERIC_FILE_NAMES.has(name))
    ) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(sourceUrl, { method: 'HEAD' });

        if (cancelled || !response.ok) {
          return;
        }

        const length = response.headers.get('content-length');
        const resolvedName = fileNameFromDisposition(response.headers.get('content-disposition'));
        const nextSize =
          sizeBytes !== null || length === null ? undefined : Number.parseInt(length, 10);
        const nextName =
          GENERIC_FILE_NAMES.has(name) && resolvedName !== null ? resolvedName : undefined;

        if (nextSize !== undefined || nextName !== undefined) {
          updateAttributes({
            ...(nextSize !== undefined && Number.isFinite(nextSize) ? { sizeBytes: nextSize } : {}),
            ...(nextName !== undefined ? { name: nextName } : {}),
          });
        }
      } catch {
        // External link without CORS: no size available, and that is not an error.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceUrl]);

  if (!fileId && !url) {
    return (
      <MediaPlaceholder
        titleKey="file"
        accept="*/*"
        busy={busy}
        onFile={handleUpload}
        onUrl={(link) => {
          if (!applyUrl(updateAttributes, link)) {
            toast(t('linkInvalid'), 'error');
          }
        }}
      />
    );
  }

  const href = fileId !== null ? bridge.fileUrl(fileId, true) : (url ?? '#');

  const urlName = url
    ? (new URL(url).pathname.split('/').filter(Boolean).at(-1) ?? new URL(url).hostname)
    : null;
  const displayName =
    fileId !== null ? name : GENERIC_FILE_NAMES.has(name) ? (urlName ?? name) : name;

  return (
    <NodeViewWrapper as="div" className="notio-file">
      <FileText className="text-muted-foreground size-5 shrink-0" aria-hidden="true" />
      <a href={href} download={displayName} className="notio-file-link" {...inputStopEvents}>
        <span className="notio-file-name">{displayName}</span>
        {sizeBytes !== null ? (
          <span className="text-muted-foreground shrink-0 text-xs">
            {formatBytes(sizeBytes, {
              byte: tSize('byte'),
              kilobyte: tSize('kilobyte'),
              megabyte: tSize('megabyte'),
            })}
          </span>
        ) : null}
      </a>
    </NodeViewWrapper>
  );
}

/** Emoji picker set: frequent symbols, no search at this stage. */
const EMOJI_CHOICES = [
  '⭐',
  '❤️',
  '🔥',
  '👍',
  '👎',
  '🎉',
  '✅',
  '❌',
  '⚡',
  '💡',
  '📌',
  '📝',
  '📅',
  '🔔',
  '🎯',
  '🚀',
  '😀',
  '😅',
  '🤔',
  '😎',
  '🥳',
  '😢',
  '😡',
  '🙏',
  '💪',
  '👀',
  '🧠',
  '☕',
  '🎵',
  '📚',
  '🛠',
  '💰',
  '🌍',
  '🌈',
  '🌙',
  '☀️',
  '🍕',
  '❗',
  '❓',
  '💬',
];

export function EmojiView({ node, updateAttributes }: ReactNodeViewProps) {
  const t = useTranslations('editor.media');
  const emoji = typeof node.attrs['emoji'] === 'string' ? node.attrs['emoji'] : '⭐';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Element && !event.target.closest('[data-emoji-picker]')) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <NodeViewWrapper as="div" className="notio-emoji">
      <button
        type="button"
        className="notio-emoji-value"
        title={t('changeEmoji')}
        {...inputStopEvents}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        {emoji}
      </button>
      {open ? (
        <div
          className="notio-emoji-picker"
          role="listbox"
          aria-label={t('emoji')}
          data-emoji-picker
        >
          {EMOJI_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              role="option"
              aria-selected={choice === emoji}
              onClick={(event) => {
                event.stopPropagation();
                updateAttributes({ emoji: choice });
                setOpen(false);
              }}
            >
              {choice}
            </button>
          ))}
        </div>
      ) : null}
    </NodeViewWrapper>
  );
}
