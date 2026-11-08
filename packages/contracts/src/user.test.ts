import { describe, expect, it } from 'vitest';
import {
  MAX_USER_PROFILES_PER_REQUEST,
  UserProfileListSchema,
  UserProfileSchema,
  UserProfilesQuerySchema,
} from './user';

describe('UserProfileSchema', () => {
  it('accepts the public user data', () => {
    const profile = {
      id: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      email: 'user@notio.dev',
      name: 'Ann',
    };

    expect(UserProfileSchema.parse(profile)).toEqual(profile);
  });

  it('does not let passwords or other internal fields through', () => {
    const parsed = UserProfileSchema.parse({
      id: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      email: 'user@notio.dev',
      name: 'Ann',
      password: 'hash',
    });

    expect(parsed).not.toHaveProperty('password');
  });

  it('requires a valid email', () => {
    expect(
      UserProfileSchema.safeParse({
        id: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
        email: 'not-an-email',
        name: 'Ann',
      }).success,
    ).toBe(false);
  });

  it('profile list accepts an array', () => {
    expect(UserProfileListSchema.parse({ items: [] })).toEqual({ items: [] });
  });
});

describe('UserProfilesQuerySchema', () => {
  const id = '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f';

  it('parses a comma-separated list of ids', () => {
    expect(UserProfilesQuerySchema.parse({ ids: `${id}, ${id}` })).toEqual({ ids: [id, id] });
  });

  it('drops empty entries', () => {
    expect(UserProfilesQuerySchema.parse({ ids: ` ,${id}, ` })).toEqual({ ids: [id] });
  });

  it('rejects an empty list and an invalid id', () => {
    expect(UserProfilesQuerySchema.safeParse({ ids: '' }).success).toBe(false);
    expect(UserProfilesQuerySchema.safeParse({ ids: 'not-an-id' }).success).toBe(false);
  });

  it('caps the request size so the response does not balloon', () => {
    const many = Array.from(
      { length: MAX_USER_PROFILES_PER_REQUEST + 1 },
      (_, index) => `1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e${index}`,
    ).join(',');

    expect(UserProfilesQuerySchema.safeParse({ ids: many }).success).toBe(false);
  });
});
