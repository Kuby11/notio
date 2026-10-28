import { describe, expect, it } from 'vitest';
import { editedAgo, shortAgo } from './time-ago';

const NOW = new Date('2026-01-15T12:00:00.000Z');

function isoAgo(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString();
}

describe('editedAgo', () => {
  it('just now — less than a minute', () => {
    expect(editedAgo(isoAgo(30), NOW)).toEqual({ unit: 'now' });
  });

  it('minutes', () => {
    expect(editedAgo(isoAgo(5 * 60), NOW)).toEqual({ unit: 'minutes', value: 5 });
    expect(editedAgo(isoAgo(59 * 60), NOW)).toEqual({ unit: 'minutes', value: 59 });
  });

  it('hours', () => {
    expect(editedAgo(isoAgo(3 * 3600), NOW)).toEqual({ unit: 'hours', value: 3 });
    expect(editedAgo(isoAgo(23 * 3600), NOW)).toEqual({ unit: 'hours', value: 23 });
  });

  it('days before a week', () => {
    expect(editedAgo(isoAgo(2 * 86400), NOW)).toEqual({ unit: 'days', value: 2 });
    expect(editedAgo(isoAgo(6 * 86400), NOW)).toEqual({ unit: 'days', value: 6 });
  });

  it('older than a week — ISO date for locale formatting', () => {
    expect(editedAgo(isoAgo(30 * 86400), NOW)).toEqual({
      unit: 'date',
      value: new Date(NOW.getTime() - 30 * 86400 * 1000).toISOString(),
    });
  });

  it('future time (clock scroll) — just now', () => {
    const future = new Date(NOW.getTime() + 5 * 60 * 1000).toISOString();
    expect(editedAgo(future, NOW)).toEqual({ unit: 'now' });
  });

  it('invalid date — null', () => {
    expect(editedAgo('not a date', NOW)).toBeNull();
  });
});

describe('shortAgo', () => {
  it('меньше минуты — нулевые секунды (Intl скажет «сейчас»)', () => {
    expect(shortAgo(isoAgo(30), NOW)).toEqual({ unit: 'second', value: 0 });
  });

  it('идёт по возрастанию единиц: минуты, часы, дни, недели, месяцы, годы', () => {
    expect(shortAgo(isoAgo(5 * 60), NOW)).toEqual({ unit: 'minute', value: -5 });
    expect(shortAgo(isoAgo(3 * 3600), NOW)).toEqual({ unit: 'hour', value: -3 });
    expect(shortAgo(isoAgo(2 * 86400), NOW)).toEqual({ unit: 'day', value: -2 });
    expect(shortAgo(isoAgo(10 * 86400), NOW)).toEqual({ unit: 'week', value: -1 });
    expect(shortAgo(isoAgo(60 * 86400), NOW)).toEqual({ unit: 'month', value: -2 });
    expect(shortAgo(isoAgo(400 * 86400), NOW)).toEqual({ unit: 'year', value: -1 });
  });

  it('знак сохраняется: будущее время — положительное значение', () => {
    const future = new Date(NOW.getTime() + 3 * 3600 * 1000).toISOString();

    expect(shortAgo(future, NOW)).toEqual({ unit: 'hour', value: 3 });
  });

  it('нечитаемая дата — null', () => {
    expect(shortAgo('not a date', NOW)).toBeNull();
  });
});
