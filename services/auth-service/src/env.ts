/**
 * Контракт окружения auth-service.
 *
 * Секреты (BETTER_AUTH_SECRET, client id/secret OAuth-провайдеров) приходят
 * через `wrangler secret` и в wrangler.jsonc их нет. Отсутствие секрета
 * ломает обслуживание запроса, а не ослабляет защиту.
 */
export interface Bindings {
  /** Изолированная база D1: user, session, account, verification, jwks. */
  DB: D1Database;
  /** Вторичное хранилище: rate limit и cookie-кэш. */
  RATE_LIMIT: KVNamespace;
  ENVIRONMENT: string;
  SERVICE_VERSION: string;
  /** Публичный адрес этого сервиса — Better Auth строит по нему ссылки. */
  BETTER_AUTH_URL: string;
  /** Адрес фронтенда: после входа и подтверждения почты пользователь попадает туда, а не на gateway. */
  FRONTEND_URL?: string;
  BETTER_AUTH_SECRET: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  /**
   * Дополнительные доверенные origin'ы через запятую: адрес фронтенда.
   * Без них вход с другого порта отклонялся бы как чужой запрос.
   */
  TRUSTED_ORIGINS?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    requestId: string;
  };
};

/** Секрет Better Auth обязателен и в dev, и в production. */
export function requireAuthSecret(env: Bindings): string {
  const secret = env.BETTER_AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      'BETTER_AUTH_SECRET не задан. Локально: добавьте его в .dev.vars, в production: wrangler secret put BETTER_AUTH_SECRET',
    );
  }

  return secret;
}
