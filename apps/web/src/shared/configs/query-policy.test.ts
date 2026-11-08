import { describe, expect, it } from 'vitest';
import { HttpError } from '../types/http-error';
import { shouldRetryQuery } from './query-policy';

describe('shouldRetryQuery', () => {
  it('does not retry 429 and other client errors', () => {
    expect(shouldRetryQuery(0, new HttpError(429, 'Too many requests'))).toBe(false);
    expect(shouldRetryQuery(0, new HttpError(401, 'Authorization required'))).toBe(false);
    expect(shouldRetryQuery(0, new HttpError(404, 'Not found'))).toBe(false);
  });

  it('retries transient errors exactly once', () => {
    expect(shouldRetryQuery(0, new HttpError(503, 'Service unavailable'))).toBe(true);
    expect(shouldRetryQuery(1, new HttpError(503, 'Service unavailable'))).toBe(false);
  });

  it('retries network errors once', () => {
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetryQuery(1, new TypeError('Failed to fetch'))).toBe(false);
  });
});
