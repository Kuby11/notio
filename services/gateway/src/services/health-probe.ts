import {
  HealthResponseSchema,
  ServiceHealthSchema,
  UNKNOWN_VERSION,
  type ServiceHealth,
  type ServiceName,
} from '@notio/contracts';
import type { Bindings } from '../env';

/** Хост Service Binding: имя сервиса, домен значения не имеет — важен путь. */
const INTERNAL_ORIGIN = 'https://internal';

export interface ServiceProbe {
  binding: 'PAGES_SERVICE' | 'AUTH_SERVICE' | 'WORKSPACE_SERVICE';
  service: ServiceName;
  path: string;
}

/**
 * Внутренние сервисы, которые gateway опрашивает для readiness.
 * Каждая проверка идёт через Service Binding — публичных адресов у сервисов нет.
 */
export const HEALTH_TARGETS = [
  { binding: 'PAGES_SERVICE', service: 'pages-service', path: '/health' },
  { binding: 'AUTH_SERVICE', service: 'auth-service', path: '/health' },
  { binding: 'WORKSPACE_SERVICE', service: 'workspace-service', path: '/health' },
] as const satisfies readonly ServiceProbe[];

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
export async function probeService(env: Bindings, target: ServiceProbe): Promise<ServiceHealth> {
  const startedAt = Date.now();
  const finish = (probe: Omit<ServiceHealth, 'latencyMs'>): ServiceHealth =>
    ServiceHealthSchema.parse({ ...probe, latencyMs: Date.now() - startedAt });

  try {
    const response = await env[target.binding].fetch(
      new Request(`${INTERNAL_ORIGIN}${target.path}`),
    );

    if (!response.ok) {
      return finish({
        service: target.service,
        status: 'degraded',
        version: UNKNOWN_VERSION,
        error: `Сервис ответил HTTP ${response.status}`,
      });
    }

    const parsed = HealthResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
      return finish({
        service: target.service,
        status: 'degraded',
        version: UNKNOWN_VERSION,
        error: 'Ответ сервиса не соответствует HealthResponseSchema',
      });
    }

    return finish({
      service: target.service,
      status: 'ok',
      version: parsed.data.version,
    });
  } catch (cause) {
    return finish({
      service: target.service,
      status: 'degraded',
      version: UNKNOWN_VERSION,
      error: cause instanceof Error ? cause.message : 'Неизвестная ошибка вызова сервиса',
    });
  }
}

/** Готовый readiness-отчёт: сам gateway плюс все внутренние сервисы. */
export async function collectHealth(env: Bindings): Promise<ServiceHealth[]> {
  const probes = await Promise.all(HEALTH_TARGETS.map((target) => probeService(env, target)));

  return [selfHealth(env), ...probes];
}
