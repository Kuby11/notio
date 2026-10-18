import { z } from 'zod';

/** Сервисы notio, участвующие в агрегированном health-отчёте. */
export const SERVICE_NAMES = [
  'gateway',
  'pages-service',
  'auth-service',
  'workspace-service',
] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export const HEALTH_STATUSES = ['ok', 'degraded'] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const UNKNOWN_VERSION = 'unknown';

/** Состояние одного сервиса в health-отчёте. */
export const ServiceHealthSchema = z.object({
  service: z.enum(SERVICE_NAMES),
  status: z.enum(HEALTH_STATUSES),
  version: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  error: z.string().min(1).optional(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

/** Агрегированный ответ `/health` и `/api/health`. */
export const HealthResponseSchema = z.object({
  status: z.enum(HEALTH_STATUSES),
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
  services: z.array(ServiceHealthSchema).min(1),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Статус всего отчёта: `degraded`, если хотя бы один сервис не `ok`.
 * Пустой список трактуется как `ok` — вызывающая сторона не передаёт
 * ни одного сервиса только в баге, а «degraded по умолчанию» скрыл бы его.
 */
export function aggregateStatus(services: readonly ServiceHealth[]): HealthStatus {
  return services.every((service) => service.status === 'ok') ? 'ok' : 'degraded';
}

/** HTTP-код ответа health: 503, если хотя бы один сервис недоступен. */
export function healthStatusCode(status: HealthStatus): 200 | 503 {
  return status === 'ok' ? 200 : 503;
}
