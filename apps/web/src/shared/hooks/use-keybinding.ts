'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Global keyboard shortcuts.
 *
 * Combos are written as strings: `mod+k`, `mod+/`, `ctrl+shift+p`. `mod` is
 * Cmd on Apple platforms and Ctrl elsewhere — the same abstraction the hint
 * labels use, so a shortcut and its visible hint never disagree. The handler
 * is kept in a ref, so callers do not need `useCallback` for the listener to
 * stay stable.
 */

interface Combo {
  key: string;
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

function parseCombo(combo: string): Combo {
  const parts = combo.toLowerCase().split('+');
  const key = parts.at(-1) ?? '';

  return {
    key,
    mod: parts.includes('mod'),
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('meta'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
}

function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
}

/**
 * Registers a window-level keydown shortcut.
 *
 * The listener ignores auto-repeat (holding the combo must not toggle
 * rapidly) and calls `preventDefault` on a match, so the browser's own
 * Ctrl+K (search bar) or Ctrl+/ (quick find) do not fight the app.
 * `shift` is only enforced when requested in the combo: on layouts where
 * "/" is typed as Shift+7, a strict check would break the shortcut.
 */
export function useKeybinding(
  combo: string,
  handler: (event: KeyboardEvent) => void,
  options: { enabled?: boolean } = {},
): void {
  const { enabled = true } = options;
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const parsed = parseCombo(combo);
    const apple = isApplePlatform();
    const wantCtrl = parsed.ctrl || (parsed.mod && !apple);
    const wantMeta = parsed.meta || (parsed.mod && apple);

    function onKeyDown(event: KeyboardEvent): void {
      if (event.repeat) {
        return;
      }

      if (event.key.toLowerCase() !== parsed.key) {
        return;
      }

      if (event.ctrlKey !== wantCtrl || event.metaKey !== wantMeta || event.altKey !== parsed.alt) {
        return;
      }

      if (parsed.shift && !event.shiftKey) {
        return;
      }

      event.preventDefault();
      handlerRef.current(event);
    }

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combo, enabled]);
}

/**
 * Display label for the `mod` key ("Ctrl" or "⌘").
 *
 * Starts as "Ctrl" so the server render matches; switches after mount on
 * Apple platforms — the same pattern the theme bootstrap uses to avoid a
 * hydration mismatch.
 */
export function useModKeyLabel(): string {
  const [label, setLabel] = useState('Ctrl');

  useEffect(() => {
    if (isApplePlatform()) {
      setLabel('⌘');
    }
  }, []);

  return label;
}
