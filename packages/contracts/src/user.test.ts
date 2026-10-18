import { describe, expect, it } from 'vitest';
import {
  MAX_USER_PROFILES_PER_REQUEST,
  UserProfileListSchema,
  UserProfileSchema,
  UserProfilesQuerySchema,
} from './user';

describe('UserProfileSchema', () => {
  it('принимает публичные данные пользователя', () => {
    const profile = {
      id: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      email: 'user@notio.dev',
      name: 'Аня',
    };

    expect(UserProfileSchema.parse(profile)).toEqual(profile);
  });

  it('не пропускает пароль и прочие внутренние поля', () => {
    const parsed = UserProfileSchema.parse({
      id: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      email: 'user@notio.dev',
      name: 'Аня',
      password: 'hash',
    });

    expect(parsed).not.toHaveProperty('password');
  });

  it('требует корректную почту', () => {
    expect(
      UserProfileSchema.safeParse({
        id: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
        email: 'не-почта',
        name: 'Аня',
      }).success,
    ).toBe(false);
  });

  it('список профилей принимает массив', () => {
    expect(UserProfileListSchema.parse({ items: [] })).toEqual({ items: [] });
  });
});

describe('UserProfilesQuerySchema', () => {
  const id = '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f';

  it('разбирает список id через запятую', () => {
    expect(UserProfilesQuerySchema.parse({ ids: `${id}, ${id}` })).toEqual({ ids: [id, id] });
  });

  it('отбрасывает пустые элементы', () => {
    expect(UserProfilesQuerySchema.parse({ ids: ` ,${id}, ` })).toEqual({ ids: [id] });
  });

  it('не принимает пустой список и неверный id', () => {
    expect(UserProfilesQuerySchema.safeParse({ ids: '' }).success).toBe(false);
    expect(UserProfilesQuerySchema.safeParse({ ids: 'не-id' }).success).toBe(false);
  });

  it('ограничивает размер запроса, чтобы ответ не раздувался', () => {
    const many = Array.from(
      { length: MAX_USER_PROFILES_PER_REQUEST + 1 },
      (_, index) => `1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e${index}`,
    ).join(',');

    expect(UserProfilesQuerySchema.safeParse({ ids: many }).success).toBe(false);
  });
});
