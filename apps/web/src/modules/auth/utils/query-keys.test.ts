import { describe, expect, it } from 'vitest';
import { authKeys } from './query-keys';

describe('authKeys', () => {
  it('держит сессию под корнем авторизации', () => {
    expect(authKeys.session()).toEqual([...authKeys.all, 'session']);
  });
});
