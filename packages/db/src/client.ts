import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';

/** Контракт окружения с биндингом базы: этого достаточно для создания клиента. */
export interface D1Binding {
  DB: D1Database;
}

/** Общий тип базы, который получают репозитории сервисов. */
export type Db<TSchema extends Record<string, unknown>> = DrizzleD1Database<TSchema>;

/**
 * Создаёт Drizzle-клиент поверх биндинга D1.
 *
 * Схему передаёт сервис: общий пакет не должен знать про таблицы конкретного
 * сервиса (database-per-service).
 */
export function createDb<TSchema extends Record<string, unknown>>(
  env: D1Binding,
  schema: TSchema,
): Db<TSchema> {
  return drizzle(env.DB, { schema });
}
