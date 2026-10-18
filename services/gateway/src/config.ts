import { isLogLevel, type LogLevel } from '@notio/observability';
import { z } from 'zod';
import type { Bindings } from './env';

/** Allowlist origin'ов: никаких «*» и никакого Reflect Origin. */
const CsvListSchema = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(z.array(z.url()));

const RateLimitSchema = z.object({
  maxRequests: z.coerce.number().int().positive().max(10_000),
  windowSeconds: z.coerce.number().int().min(1).max(3600),
});

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

export interface GatewayConfig {
  logLevel: LogLevel;
  allowedOrigins: string[];
  rateLimit: RateLimitConfig;
  isProduction: boolean;
}

/**
 * Конфигурация gateway из переменных окружения.
 *
 * Значения из wrangler.jsonc — единственный источник, секреты сюда не попадают.
 * Некорректная конфигурация ломает старт воркера, а не молча ослабляет защиту.
 */
export function readGatewayConfig(env: Bindings): GatewayConfig {
  const logLevel = isLogLevel(env.LOG_LEVEL) ? env.LOG_LEVEL : 'info';
  const origins = CsvListSchema.parse(env.CORS_ALLOWED_ORIGINS ?? '');
  const rateLimit = RateLimitSchema.parse({
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
  });

  return {
    logLevel,
    allowedOrigins: origins,
    rateLimit,
    isProduction: env.ENVIRONMENT === 'production',
  };
}
