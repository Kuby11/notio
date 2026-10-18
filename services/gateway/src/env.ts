/**
 * Контракт окружения gateway.
 *
 * Типы биндингов генерируются `wrangler types` в `worker-configuration.d.ts`.
 * Внутренние сервисы доступны только через Service Bindings — прямых
 * HTTP-вызовов между сервисами в проекте нет.
 */
export interface Bindings {
  /** Внутренний доступ к pages-service (без публичного HTTP). */
  PAGES_SERVICE: Fetcher;
  ENVIRONMENT: string;
  SERVICE_VERSION: string;
}

export type AppEnv = {
  Bindings: Bindings;
};
