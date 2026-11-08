/**
 * "Time ago" for the edit timestamp in the page header.
 *
 * Returns a structure rather than a string: time units are translated
 * on the UI side (next-intl), the utility remains pure logic.
 */
export type EditedAgo =
  | { unit: 'now' }
  | { unit: 'minutes'; value: number }
  | { unit: 'hours'; value: number }
  | { unit: 'days'; value: number }
  /** Long ago: show date; UI formats ISO for the current locale. */
  | { unit: 'date'; value: string };

export function editedAgo(iso: string, now: Date = new Date()): EditedAgo | null {
  const edited = new Date(iso);

  if (Number.isNaN(edited.getTime())) {
    return null;
  }

  const seconds = Math.floor((now.getTime() - edited.getTime()) / 1000);

  if (seconds < 60) {
    return { unit: 'now' };
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return { unit: 'minutes', value: minutes };
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return { unit: 'hours', value: hours };
  }

  const days = Math.floor(hours / 24);

  if (days < 7) {
    return { unit: 'days', value: days };
  }

  return { unit: 'date', value: edited.toISOString() };
}

/** Unit of `Intl.RelativeTimeFormat`: compact columns need weeks and months too. */
export type ShortAgoUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export interface ShortAgo {
  unit: ShortAgoUnit;
  value: number;
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/**
 * Compact "time ago" for table cells, as a unit + value pair.
 *
 * The sign is kept (negative = in the past) so `Intl.RelativeTimeFormat` can
 * phrase it in the current locale ("2d ago"). Anything under a
 * minute collapses to zero seconds, which `numeric: 'auto'` renders as "now".
 */
export function shortAgo(iso: string, now: Date = new Date()): ShortAgo | null {
  const at = new Date(iso);

  if (Number.isNaN(at.getTime())) {
    return null;
  }

  const seconds = Math.round((at.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < MINUTE) {
    return { unit: 'second', value: 0 };
  }

  if (abs < HOUR) {
    return { unit: 'minute', value: Math.round(seconds / MINUTE) };
  }

  if (abs < DAY) {
    return { unit: 'hour', value: Math.round(seconds / HOUR) };
  }

  if (abs < WEEK) {
    return { unit: 'day', value: Math.round(seconds / DAY) };
  }

  if (abs < MONTH) {
    return { unit: 'week', value: Math.round(seconds / WEEK) };
  }

  if (abs < YEAR) {
    return { unit: 'month', value: Math.round(seconds / MONTH) };
  }

  return { unit: 'year', value: Math.round(seconds / YEAR) };
}
