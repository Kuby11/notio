'use client';

import { Download, Minus, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '../../../../shared/ui/dialog';

interface MediaLightboxProps {
  src: string;
  alt: string;
  /** URL with ?download=1 for saving (for external links, the link itself). */
  downloadUrl: string;
  onClose: () => void;
}

const ZOOM_STEP = 0.25;
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;

/**
 * Full-screen image viewer on a shadcn Dialog: a double click on the
 * block opens the lightbox with zoom, download and close (Esc/cross).
 *
 * The content is stretched across the screen and transparent — the dialog's
 * Backdrop provides the dimming; overflow is not hidden, so the enlarged
 * image spills past the edges.
 */
export function MediaLightbox({ src, alt, downloadUrl, onClose }: MediaLightboxProps) {
  const t = useTranslations('editor.media.lightbox');
  const [zoom, setZoom] = useState(1);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="h-screen max-h-none w-screen max-w-none -translate-x-1/2 -translate-y-1/2 overflow-visible rounded-none border-0 bg-black/80 p-0"
      >
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>

        <div className="notio-lightbox-toolbar">
          <button
            type="button"
            aria-label={t('zoomOut')}
            title={t('zoomOut')}
            disabled={zoom <= ZOOM_MIN}
            onClick={() => setZoom((value) => Math.max(ZOOM_MIN, value - ZOOM_STEP))}
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span className="notio-lightbox-zoom" aria-live="polite">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label={t('zoomIn')}
            title={t('zoomIn')}
            disabled={zoom >= ZOOM_MAX}
            onClick={() => setZoom((value) => Math.min(ZOOM_MAX, value + ZOOM_STEP))}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <a
            href={downloadUrl}
            download=""
            aria-label={t('download')}
            title={t('download')}
            rel="noopener noreferrer"
          >
            <Download className="size-4" aria-hidden="true" />
          </a>
          <button type="button" aria-label={t('close')} title={t('close')} onClick={onClose}>
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="notio-lightbox-stage">
          <img src={src} alt={alt} style={{ transform: `scale(${zoom})` }} draggable={false} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
