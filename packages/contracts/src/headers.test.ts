import { describe, expect, it } from 'vitest';
import { GATEWAY_SOURCE, INTERNAL_HEADERS, SERVICE_RESPONSE_HEADER } from './headers';

describe('Internal headers', () => {
  it('keeps the wire names stable', () => {
    expect(INTERNAL_HEADERS).toEqual({
      REQUEST_ID: 'x-request-id',
      ACTOR_ID: 'x-user-id',
      SOURCE_SERVICE: 'x-notio-source',
    });
    expect(GATEWAY_SOURCE).toBe('gateway');
    expect(SERVICE_RESPONSE_HEADER).toBe('x-notio-served-by');
  });

  it('exposes every value as an InternalHeaderName', () => {
    const names: string[] = Object.values(INTERNAL_HEADERS);
    expect(names).toHaveLength(3);
    for (const name of names) {
      expect(name.startsWith('x-')).toBe(true);
    }
  });
});
