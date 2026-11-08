import { describe, expect, it } from 'vitest';
import { authKeys } from './query-keys';

describe('authKeys', () => {
  it('keeps the session under the auth root', () => {
    expect(authKeys.session()).toEqual([...authKeys.all, 'session']);
  });
});
