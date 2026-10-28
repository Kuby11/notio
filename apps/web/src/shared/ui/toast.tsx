'use client';

import { create } from 'zustand';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Минимальные тосты без зависимостей: стор на zustand + один <Toaster />
 * в providers. Экраны ошибок форм и error boundary остаются на своих
 * местах; тосты — для кратких уведомлений действий (загрузка файлов).
 */

export type ToastTone = 'error' | 'success';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone: ToastTone) => void;
  dismiss: (id: number) => void;
}

let nextToastId = 1;

const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, tone) => {
    const id = nextToastId++;

    set((state) => ({ items: [...state.items, { id, message, tone }] }));

    // Авторазварачивание: у тоста нет причин задерживаться надолго.
    setTimeout(() => {
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
    }, 5000);
  },
  dismiss: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
  },
}));

/** Показать тост — единственная точка входа для остального кода. */
export function toast(message: string, tone: ToastTone = 'error'): void {
  useToastStore.getState().push(message, tone);
}

/** Стек тостов: монтируется один раз в providers. */
export function Toaster() {
  const t = useTranslations('common');
  const items = useToastStore((state) => state.items);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    if (items.length === 0) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        for (const item of items) {
          dismiss(item.id);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [items, dismiss]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label={t('notifications')}
      className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-80 flex-col gap-2"
    >
      {items.map((item) => (
        <div
          key={item.id}
          role={item.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg ${
            item.tone === 'error'
              ? 'bg-destructive text-white border-transparent'
              : 'bg-popover text-popover-foreground'
          }`}
        >
          <span className="min-w-0 flex-1">{item.message}</span>
          <button
            type="button"
            aria-label={t('dismissNotification')}
            onClick={() => dismiss(item.id)}
            className="shrink-0 rounded px-1 opacity-70 transition-opacity hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
