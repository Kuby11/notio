import { z } from 'zod';

export const SERVICE_NAMES = [
  'gateway',
  'pages-service',
  'auth-service',
  'workspace-service',
  'media-service',
] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];

export const HEALTH_STATUSES = ['ok', 'degraded'] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const UNKNOWN_VERSION = 'unknown';

export const ServiceHealthSchema = z.object({
  service: z.enum(SERVICE_NAMES),
  status: z.enum(HEALTH_STATUSES),
  version: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  error: z.string().min(1).optional(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

export const HealthResponseSchema = z.object({
  status: z.enum(HEALTH_STATUSES),
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
  services: z.array(ServiceHealthSchema).min(1),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Status of the whole report: `degraded` if at least one service is not `ok`.
 * An empty list counts as `ok` — a caller passing no services can only be a
 * bug, and a "degraded by default" would hide it.
 */
export function aggregateStatus(services: readonly ServiceHealth[]): HealthStatus {
  return services.every((service) => service.status === 'ok') ? 'ok' : 'degraded';
}

/** HTTP status of the health response: 503 when at least one service is down. */
export function healthStatusCode(status: HealthStatus): 200 | 503 {
  return status === 'ok' ? 200 : 503;
}
