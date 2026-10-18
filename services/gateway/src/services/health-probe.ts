import {
  HealthResponseSchema,
  ServiceHealthSchema,
  UNKNOWN_VERSION,
  type ServiceHealth,
} from '@notio/contracts';
import type { Bindings } from '../env';

/** Хост Service Binding: имя сервиса, домен значения не имеет — важен путь. */
const PAGES_SERVICE_ORIGIN = 'https://pages-service';

const HEALTH_URL = `${PAGES_SERVICE_ORIGIN}/health`;

/** Собственное состояние gateway: сервис не зависит от соседей и отвечает всегда. */
export function selfHealth(env: Bindings): ServiceHealth {
  return {
    service: 'gateway',
    status: 'ok',
    version: env.SERVICE_VERSION,
    latencyMs: 0,
  };
}

/**
 * Пробует внутренний сервис и превращает любой исход в состояние.
 * Ни одна ошибка не пробрасывается наружу: детали уходят в лог-агрегатор,
 * клиент получает обезличенный статус в health-отчёте.
 */
export async function probePagesService(env: Bindings): Promise<ServiceHealth> {
  const startedAt = Date.now();
  const finish = (probe: Omit<ServiceHealth, 'latencyMs'>): ServiceHealth =>
    ServiceHealthSchema.parse({ ...probe, latencyMs: Date.now() - startedAt });

  try {
    const response = await env.PAGES_SERVICE.fetch(new Request(HEALTH_URL));

    if (!response.ok) {
      return finish({
        service: 'pages-service',
        status: 'degraded',
        version: UNKNOWN_VERSION,
        error: `Сервис ответил HTTP ${response.status}`,
      });
    }

    const parsed = HealthResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
      return finish({
        service: 'pages-service',
        status: 'degraded',
        version: UNKNOWN_VERSION,
        error: 'Ответ сервиса не соответствует HealthResponseSchema',
      });
    }

    return finish({
      service: 'pages-service',
      status: 'ok',
      version: parsed.data.version,
    });
  } catch (cause) {
    return finish({
      service: 'pages-service',
      status: 'degraded',
      version: UNKNOWN_VERSION,
      error: cause instanceof Error ? cause.message : 'Неизвестная ошибка вызова сервиса',
    });
  }
}
