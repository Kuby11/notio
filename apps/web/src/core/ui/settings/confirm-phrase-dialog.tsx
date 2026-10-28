'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';

/** Seconds the confirm button stays locked: enough to read the consequence. */
export const CONFIRM_COUNTDOWN_SECONDS = 5;

interface ConfirmPhraseDialogProps {
  open: boolean;
  title: string;
  description: string;
  /** Phrase the user has to retype; comparison ignores case and surrounding spaces. */
  phrase: string;
  confirmLabel: string;
  /** Shown on the confirm button while the countdown runs. */
  countdownLabel: (seconds: number) => string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * Destructive confirmation: a countdown plus the object's name typed by hand.
 *
 * Both guards are deliberately client-side — they slow down a misclick, they
 * are not a security boundary. The countdown restarts every time the dialog is
 * opened, so closing it is always a way to abort.
 */
export function ConfirmPhraseDialog({
  open,
  title,
  description,
  phrase,
  confirmLabel,
  countdownLabel,
  busy = false,
  onOpenChange,
  onConfirm,
}: ConfirmPhraseDialogProps) {
  const t = useTranslations('settings.confirm');
  const inputId = useId();
  const [value, setValue] = useState('');
  const [remaining, setRemaining] = useState(CONFIRM_COUNTDOWN_SECONDS);

  useEffect(() => {
    if (!open) {
      return;
    }

    setValue('');
    setRemaining(CONFIRM_COUNTDOWN_SECONDS);

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const passed = Math.floor((Date.now() - startedAt) / 1000);
      const left = Math.max(0, CONFIRM_COUNTDOWN_SECONDS - passed);

      setRemaining(left);

      if (left === 0) {
        clearInterval(timer);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [open]);

  const typed = value.trim().toLowerCase();
  const matches = typed.length > 0 && typed === phrase.trim().toLowerCase();
  const locked = remaining > 0 || !matches || busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValue('');
        }

        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            {t('typeToConfirm', { phrase })}
          </label>
          <Input
            id={inputId}
            value={value}
            autoComplete="off"
            aria-invalid={value.trim().length > 0 && !matches}
            onChange={(event) => setValue(event.target.value)}
          />
          {value.trim().length > 0 && !matches ? (
            <p role="alert" className="text-destructive text-xs">
              {t('mismatch')}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={locked}
            onClick={() => {
              if (!locked) {
                onConfirm();
              }
            }}
          >
            {busy ? t('working') : remaining > 0 ? countdownLabel(remaining) : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
