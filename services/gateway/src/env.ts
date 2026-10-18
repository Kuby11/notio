/**
 * Контракт окружения gateway.
 *
 * Типы биндингов генерируются `wrangler types` в `worker-configuration.d.ts`.
 * Внутренние сервисы доступны только через Service Bindings — прямых
 * HTTP-вызовов между сервисами в проекте нет.
 */
import type { GatewayConfig } from './config';

export interface Bindings {
  /** Внутренний доступ к pages-service (без публичного HTTP). */
  PAGES_SERVICE: Fetcher;
  /** Счётчики rate limit. */
  RATE_LIMIT: KVNamespace;
  ENVIRONMENT: string;
  SERVICE_VERSION: string;
  LOG_LEVEL: string;
  /** Разрешённые origins для CORS, через запятую. */
  CORS_ALLOWED_ORIGINS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
}

export interface Variables {
  /** Сквозной идентификатор запроса, положенный middleware. */
  requestId: string;
  /** Конфигурация, разобранная из vars текущего запроса. */
  config: GatewayConfig;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
