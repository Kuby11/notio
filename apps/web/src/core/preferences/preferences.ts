import type { ThemeChoice } from '../ui/theme';

/**
 * Preferences that belong to this browser rather than to the account.
 *
 * Everything here is stored in localStorage and read after mount: the server
 * has no localStorage, and a first render with a different value would break
 * hydration. Values are plain strings, so a stale or hand-edited entry falls
 * back to the default instead of breaking the interface.
 */

/** Grouping and decimal separators of the chosen locale. */
export type NumberFormatChoice = 'en-US' | 'de-DE' | 'ru-RU';

/** Order of the date parts; 'long' is the spelled-out month form. */
export type DateFormatChoice = 'dmy' | 'mdy' | 'iso' | 'long';

/** What a workspace shows when it is opened. */
export type StartPageChoice = 'home' | 'last';

export interface RegionalPreferences {
  /** Follow the device time zone instead of `timeZone`. */
  autoTimeZone: boolean;
  /** IANA zone id, e.g. Europe/Berlin; empty means "not chosen yet". */
  timeZone: string;
  numberFormat: NumberFormatChoice;
  dateFormat: DateFormatChoice;
  startPage: StartPageChoice;
}

export interface Preferences extends RegionalPreferences {
  theme: ThemeChoice;
}

export const PREFERENCES_STORAGE_KEY = 'notio-preferences';

export const NUMBER_FORMATS: readonly NumberFormatChoice[] = ['en-US', 'de-DE', 'ru-RU'];

export const DATE_FORMATS: readonly DateFormatChoice[] = ['dmy', 'mdy', 'iso', 'long'];

export const START_PAGES: readonly StartPageChoice[] = ['home', 'last'];

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  autoTimeZone: true,
  timeZone: '',
  numberFormat: 'en-US',
  dateFormat: 'dmy',
  startPage: 'home',
};

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

/** Guards for control values: a `<select>` hands back a plain string. */
export function isNumberFormat(value: string): value is NumberFormatChoice {
  return isOneOf(value, NUMBER_FORMATS);
}

export function isDateFormat(value: string): value is DateFormatChoice {
  return isOneOf(value, DATE_FORMATS);
}

export function isStartPage(value: string): value is StartPageChoice {
  return isOneOf(value, START_PAGES);
}

/** The stored regional settings; anything invalid falls back to the defaults. */
export function readStoredPreferences(): RegionalPreferences {
  const defaults: RegionalPreferences = {
    autoTimeZone: DEFAULT_PREFERENCES.autoTimeZone,
    timeZone: DEFAULT_PREFERENCES.timeZone,
    numberFormat: DEFAULT_PREFERENCES.numberFormat,
    dateFormat: DEFAULT_PREFERENCES.dateFormat,
    startPage: DEFAULT_PREFERENCES.startPage,
  };

  if (typeof window === 'undefined') {
    return defaults;
  }

  let parsed: unknown;

  try {
    const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);

    if (raw === null) {
      return defaults;
    }

    parsed = JSON.parse(raw);
  } catch {
    // Unreadable storage is not an error the user can act on: defaults are enough.
    return defaults;
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return defaults;
  }

  const record: Record<string, unknown> = { ...parsed };

  return {
    autoTimeZone:
      typeof record['autoTimeZone'] === 'boolean' ? record['autoTimeZone'] : defaults.autoTimeZone,
    timeZone: typeof record['timeZone'] === 'string' ? record['timeZone'] : defaults.timeZone,
    numberFormat: isOneOf(record['numberFormat'], NUMBER_FORMATS)
      ? record['numberFormat']
      : defaults.numberFormat,
    dateFormat: isOneOf(record['dateFormat'], DATE_FORMATS)
      ? record['dateFormat']
      : defaults.dateFormat,
    startPage: isOneOf(record['startPage'], START_PAGES) ? record['startPage'] : defaults.startPage,
  };
}

export function storePreferences(preferences: RegionalPreferences): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
}

/** The device time zone; UTC when the runtime refuses to tell. */
export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** The zone used for formatting: the device one while "automatic" is on. */
export function resolveTimeZone(preferences: RegionalPreferences): string {
  if (preferences.autoTimeZone) {
    return detectTimeZone();
  }

  return preferences.timeZone || detectTimeZone();
}

/**
 * Selectable zones. `Intl.supportedValuesOf` is the only list that follows the
 * platform's tz database, so it is used when available; the device zone always
 * stays in the list so the current choice can be shown.
 */
export function timeZoneOptions(): readonly string[] {
  const current = detectTimeZone();

  const supported =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : [current, 'UTC'];

  return supported.includes(current) ? supported : [current, ...supported];
}

/**
 * GMT offset of an IANA zone as a compact label, e.g. "GMT+4", "GMT-5", "GMT".
 *
 * A zone that observes daylight saving shows both of its offsets as a range
 * ("GMT+2/+3"), because a single number would be wrong for half the year.
 * Zones with a fractional offset keep the fraction ("GMT+5:30").
 */
export function timeZoneOffsetLabel(zone: string, referenceDate: Date = new Date()): string {
  const year = referenceDate.getUTCFullYear();
  const winter = zoneOffsetMinutes(zone, new Date(Date.UTC(year, 0, 1)));
  const summer = zoneOffsetMinutes(zone, new Date(Date.UTC(year, 6, 1)));

  if (winter === null || summer === null) {
    return '';
  }

  if (winter === summer) {
    return formatZoneOffset(winter);
  }

  const [earlier, later] = winter < summer ? [winter, summer] : [summer, winter];
  const [earlierLabel, laterLabel] = [formatZoneOffset(earlier), formatZoneOffset(later)];
  const earlierPrefix = earlierLabel.replace(/GMT/, '');

  // "GMT+2/+3": reuse the sign of the first offset when both share it.
  return `GMT${earlierPrefix}/${laterLabel}`;
}

/** Offset of the zone from GMT in minutes at the given instant, or null. */
function zoneOffsetMinutes(zone: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at);

    const value = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);

    // hour12 can render midnight as 24 — normalise it back to 0.
    const hour = value('hour') % 24;
    const asUtc = Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      hour,
      value('minute'),
      value('second'),
    );

    return Math.round((asUtc - at.getTime()) / 60_000);
  } catch {
    return null;
  }
}

/** Renders a whole-minute GMT offset as "GMT", "GMT+4", "GMT-5:30". */
function formatZoneOffset(totalMinutes: number): string {
  if (totalMinutes === 0) {
    return 'GMT';
  }

  const sign = totalMinutes > 0 ? '+' : '-';
  const absolute = Math.abs(totalMinutes);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;

  return minutes === 0
    ? `GMT${sign}${hours}`
    : `GMT${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
}

export function formatNumber(value: number, preferences: RegionalPreferences): string {
  return new Intl.NumberFormat(preferences.numberFormat).format(value);
}

/**
 * Formats a date by the chosen pattern.
 *
 * Part order is assembled by hand: `Intl` would follow the locale's own order,
 * and the point of the setting is to ignore it.
 */
export function formatDate(
  value: string | Date,
  preferences: RegionalPreferences,
  locale: string,
): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const timeZone = resolveTimeZone(preferences);

  if (preferences.dateFormat === 'long') {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone }).format(date);
  }

  // en-GB gives unambiguous numeric parts, which are then re-ordered below.
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '';

  const day = part('day');
  const month = part('month');
  const year = part('year');

  switch (preferences.dateFormat) {
    case 'dmy':
      return `${day}.${month}.${year}`;
    case 'mdy':
      return `${month}/${day}/${year}`;
    case 'iso':
      return `${year}-${month}-${day}`;
    default:
      return `${day}.${month}.${year}`;
  }
}

/** Example date for the settings preview: a fixed date, not "now". */
export const SAMPLE_DATE = '2026-10-26T12:00:00.000Z';

/** Example number for the settings preview: grouping and decimals visible. */
export const SAMPLE_NUMBER = 1_234_567.89;
