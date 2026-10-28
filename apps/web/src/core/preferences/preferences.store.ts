'use client';

import { create } from 'zustand';
import {
  DEFAULT_PREFERENCES,
  readStoredPreferences,
  storePreferences,
  type DateFormatChoice,
  type NumberFormatChoice,
  type Preferences,
  type RegionalPreferences,
  type StartPageChoice,
} from './preferences';
import { readStoredTheme, storeTheme, type ThemeChoice } from '../ui/theme';

/**
 * Preferences store.
 *
 * State is empty-by-default on the server and filled from localStorage after
 * mount (`hydrate`). The theme keeps its own storage key: the inline script in
 * the root layout reads that key before hydration to avoid a light flash.
 */

interface PreferencesState extends Preferences {
  /** True once localStorage has been read at least once. */
  hydrated: boolean;
  hydrate: () => void;
  setTheme: (theme: ThemeChoice) => void;
  setAutoTimeZone: (auto: boolean) => void;
  setTimeZone: (timeZone: string) => void;
  setNumberFormat: (format: NumberFormatChoice) => void;
  setDateFormat: (format: DateFormatChoice) => void;
  setStartPage: (startPage: StartPageChoice) => void;
}

function regionalOf(state: PreferencesState): RegionalPreferences {
  return {
    autoTimeZone: state.autoTimeZone,
    timeZone: state.timeZone,
    numberFormat: state.numberFormat,
    dateFormat: state.dateFormat,
    startPage: state.startPage,
  };
}

export const usePreferencesStore = create<PreferencesState>((set, get) => {
  /** Writes the regional part and leaves the rest of the state untouched. */
  const persist = (patch: Partial<RegionalPreferences>): void => {
    set(patch);
    storePreferences(regionalOf(get()));
  };

  return {
    ...DEFAULT_PREFERENCES,
    hydrated: false,

    hydrate: () => {
      set({ ...readStoredPreferences(), theme: readStoredTheme(), hydrated: true });
    },

    setTheme: (theme) => {
      storeTheme(theme);
      set({ theme });
    },

    setAutoTimeZone: (autoTimeZone) => {
      persist({ autoTimeZone });
    },

    setTimeZone: (timeZone) => {
      persist({ timeZone });
    },

    setNumberFormat: (numberFormat) => {
      persist({ numberFormat });
    },

    setDateFormat: (dateFormat) => {
      persist({ dateFormat });
    },

    setStartPage: (startPage) => {
      persist({ startPage });
    },
  };
});

/** Preferences for components: the store plus the one-time storage read. */
export function usePreferences(): PreferencesState {
  return usePreferencesStore();
}
