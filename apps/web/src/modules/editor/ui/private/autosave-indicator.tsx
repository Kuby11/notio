import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AutosaveStatus } from '../../hooks/use-editor';

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
}

/**
 * Autosave indicator in the top-right corner of the editor.
 *
 * A zero-height bar does not shift the document, and `sticky` keeps the spinner
 * in view while a long page scrolls. The top-10 offset sits under the page's
 * sticky header panel (h-10); otherwise the panel would cover it.
 */
export function AutosaveIndicator({ status }: AutosaveIndicatorProps) {
  const t = useTranslations('editor');
  const isSaving = status === 'pending' || status === 'saving';

  return (
    <div className="sticky top-10 z-10 flex h-0 justify-end">
      {isSaving && (
        <span role="status" aria-label={t('saving')} className="text-muted-foreground inline-flex">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        </span>
      )}
    </div>
  );
}
