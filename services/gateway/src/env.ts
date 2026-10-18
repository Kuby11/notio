/**
 * Контракт окружения gateway.
 *
 * Типы биндингов генерируются `wrangler types` в `worker-configuration.d.ts`.
 * Внутренние сервисы доступны только через Service Bindings — прямых
 * HTTP-входов между сервисами в проекте нет.
 */
import type { AuthenticatedUser } from '@notio/contracts';
import type { GatewayConfig } from './config';

export interface Bindings {
  /** Внутренний доступ к pages-service (без публичного HTTP). */
  PAGES_SERVICE: Fetcher;
  /** Внутренний доступ к auth-service: проверка токенов и JWKS. */
  AUTH_SERVICE: Fetcher;
  /** Внутренний доступ к workspace-service: рабочие пространства и участники. */
  WORKSPACE_SERVICE: Fetcher;
  /** Счётчики rate limit. */
  RATE_LIMIT: KVNamespace;
  ENVIRONMENT: string;
  SERVICE_VERSION: string;
  LOG_LEVEL: string;
  /** Разрешённые origins для CORS, через запятую. */
  CORS_ALLOWED_ORIGINS: string;
  RATE_LIMIT_MAX_REQUESTS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  /** Как долго кешируется JWKS, полученный у auth-service (секунды). */
  AUTH_JWKS_CACHE_TTL_SECONDS?: string;
}

export interface Variables {
  /** Сквозной идентификатор запроса, положенный middleware. */
  requestId: string;
  /** Конфигурация, разобранная из vars текущего запроса. */
  config: GatewayConfig;
  /** Пользователь из подписанного JWT; null — запрос без аутентификации. */
  user: AuthenticatedUser | null;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: Variables;
};
