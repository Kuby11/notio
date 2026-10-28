/**
 * Appearance theme: light, dark and system.
 *
 * The choice is stored in localStorage, applied as the `dark` class on <html>.
 * The value is read before React hydration by an inline script in the root
 * layout (THEME_APPLY_SCRIPT), so there is no flash of the light theme.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'notio-theme';

/** Options in display order; labels live in messages/*.json. */
export const THEME_CHOICES: readonly ThemeChoice[] = ['light', 'dark', 'system'];

/** The saved choice; an invalid value counts as "system". */
export function readStoredTheme(): ThemeChoice {
  if (typeof window === 'undefined') {
    return 'system';
  }

  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);

  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/** Applies the choice: dark = explicit dark, or system with prefers-dark. */
export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === 'undefined') {
    return;
  }

  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  document.documentElement.classList.toggle(
    'dark',
    choice === 'dark' || (choice === 'system' && prefersDark),
  );
}

/** Saves the choice and applies it immediately. */
export function storeTheme(choice: ThemeChoice): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  applyTheme(choice);
}

/**
 * Inline script for the root layout: runs before the first paint, otherwise a
 * saved dark theme would flash a light frame.
 */
export const THEME_APPLY_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t==='dark'||(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
