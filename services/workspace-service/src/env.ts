/**
 * Контракт окружения workspace-service.
 *
 * Типы биндингов генерируются `wrangler types` в `worker-configuration.d.ts`.
 * Сервис владеет собственной базой и наружу не публикуется: в интернет есть
 * только gateway, внутрь — только Service Binding от него.
 */
export interface Bindings {
  /** Изолированная база D1, принадлежащая только workspace-service. */
  DB: D1Database;
  /** Профили пользователей: почта и имя приходят из auth-service. */
  AUTH_SERVICE: Fetcher;
  ENVIRONMENT: string;
  SERVICE_VERSION: string;
  /** Публичный адрес gateway: в него собирается ссылка-приглашение. */
  PUBLIC_GATEWAY_URL: string;
  /** Публичный адрес фронтенда: он же в ссылке-приглашении. */
  PUBLIC_APP_URL: string;
  /**
   * Срок жизни ссылки-приглашения в днях.
   */
  INVITATION_TTL_DAYS: string;
  /**
   * Сколько дней живёт архивный workspace, прежде чем его удалить по cron.
   * Архив временный: иначе удалённые рабочие пространства копятся вечно.
   */
  ARCHIVE_RETENTION_DAYS: string;
  /** Максимум активных приглашений на workspace, чтобы ссылками не заливали. */
  MAX_ACTIVE_INVITATIONS: string;
}

export type AppEnv = {
  Bindings: Bindings;
};
