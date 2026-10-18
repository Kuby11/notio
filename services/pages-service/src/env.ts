/**
 * Контракт окружения pages-service.
 *
 * Типы биндингов генерируются `wrangler types` в `worker-configuration.d.ts`,
 * а этот интерфейс описывает то, что сервис ожидает получить: если конфиг и
 * интерфейс разойдутся, упадёт компиляция, а не рантайм.
 *
 * Сервис владеет собственной базой (database-per-service) и наружу не
 * публикуется: в интернет есть только gateway, внутри — только Service Binding.
 */
export interface Bindings {
  /** Изолированная база D1, принадлежащая только pages-service. */
  DB: D1Database;
  ENVIRONMENT: string;
  SERVICE_VERSION: string;
}

export type AppEnv = {
  Bindings: Bindings;
};
