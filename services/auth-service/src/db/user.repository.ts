import { eq, inArray } from 'drizzle-orm';
import { createDb, type D1Binding } from '@notio/db';
import type { UserProfile } from '@notio/contracts';
import * as authSchema from './auth-schema.generated';

/**
 * Прямой доступ к таблице пользователей.
 *
 * Нужен там, где ответ Better Auth нас не устраивает: он отвечает 200 на
 * повторную регистрацию того же email, хотя строка не создаётся. Проверка
 * занятости почты до вызова Better Auth делает поведение предсказуемым.
 */

/**
 * В сгенерированном модуле есть `relations` — это не таблица, и передавать его
 * в Drizzle нельзя: типы клиента перестают выводиться. Поэтому собираем
 * схему из таблиц явно.
 */
const tables = {
  user: authSchema.user,
  session: authSchema.session,
  account: authSchema.account,
  verification: authSchema.verification,
  jwks: authSchema.jwks,
};

export interface UserAccount {
  id: string;
  email: string;
  emailVerified: boolean;
}

export function createUserRepository(env: D1Binding) {
  const client = createDb(env, tables);

  return {
    /** Ищет пользователя по почте; адрес сравнивается в нижнем регистре. */
    async findByEmail(email: string): Promise<UserAccount | null> {
      const [user] = await client
        .select({
          id: tables.user.id,
          email: tables.user.email,
          emailVerified: tables.user.emailVerified,
        })
        .from(tables.user)
        .where(eq(tables.user.email, email.trim().toLowerCase()))
        .limit(1);

      return user ?? null;
    },

    /** Публичные профили по id: нужны другим сервисам для списков участников. */
    async findProfilesByIds(ids: string[]): Promise<UserProfile[]> {
      if (ids.length === 0) {
        return [];
      }

      const rows = await client
        .select({ id: tables.user.id, email: tables.user.email, name: tables.user.name })
        .from(tables.user)
        .where(inArray(tables.user.id, ids));

      return rows;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
