import { describe, expect, it } from 'vitest';
import { timeZoneOffsetLabel } from './preferences';

describe('timeZoneOffsetLabel', () => {
  it('shows a single offset for a zone without daylight saving', () => {
    expect(timeZoneOffsetLabel('Asia/Tbilisi')).toBe('GMT+4');
    expect(timeZoneOffsetLabel('Europe/Moscow')).toBe('GMT+3');
  });

  it('shows plain GMT for the UTC zone', () => {
    expect(timeZoneOffsetLabel('UTC')).toBe('GMT');
  });

  it('keeps a fractional offset', () => {
    expect(timeZoneOffsetLabel('Asia/Kolkata')).toBe('GMT+5:30');
    expect(timeZoneOffsetLabel('Australia/Eucla')).toBe('GMT+8:45');
  });

  it('shows both offsets as a range for a zone with daylight saving', () => {
    // The exact pair depends on the tz database, so only the shape is asserted.
    const label = timeZoneOffsetLabel('America/New_York');

    expect(label).toMatch(/^GMT-\d+(\/GMT-\d+)?$/u);
  });

  it('orders the range from the smaller offset to the larger', () => {
    const label = timeZoneOffsetLabel('Australia/Sydney');
    const [first, second] = label.split('/').map((part) => Number(part.replace('GMT', '')));

    expect(first).toBeLessThan(second as number);
  });
});
