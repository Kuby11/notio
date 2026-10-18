import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { createDb } from '@notio/db';
import type { Bindings } from '../env';
import * as authSchema from './auth-schema.generated';

/**
 * Адаптер базы для Better Auth: Drizzle поверх биндинга D1.
 *
 * Схема сгенерирована `@better-auth/cli generate` и хранит поля в snake_case,
 * поэтому нативный D1-адаптер Better Auth (ожидающий camelCase) здесь неприменим.
 * Файл схемы переиспользуется вручную только через регенерацию CLI.
 */
export function createAuthDatabase(env: Bindings) {
  return drizzleAdapter(createDb(env, authSchema), {
    provider: 'sqlite',
    schema: authSchema,
  });
}
