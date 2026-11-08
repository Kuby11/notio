import {
  HealthResponseSchema,
  ServiceHealthSchema,
  UNKNOWN_VERSION,
  type ServiceHealth,
  type ServiceName,
} from '@notio/contracts';
import type { Bindings } from '../env';

/** Service Binding host: the service name goes in the host, only the path matters. */
const INTERNAL_ORIGIN = 'https://internal';

export interface ServiceProbe {
  binding: 'PAGES_SERVICE' | 'AUTH_SERVICE' | 'WORKSPACE_SERVICE';
  service: ServiceName;
  path: string;
}

/**
 * Internal services the gateway probes for readiness.
 * Each check goes through a Service Binding — the services have no public addresses.
 */
export const HEALTH_TARGETS = [
  { binding: 'PAGES_SERVICE', service: 'pages-service', path: '/health' },
  { binding: 'AUTH_SERVICE', service: 'auth-service', path: '/health' },
  { binding: 'WORKSPACE_SERVICE', service: 'workspace-service', path: '/health' },
] as const satisfies readonly ServiceProbe[];

/** Own state of the gateway: it does not depend on neighbours and always answers. */
export function selfHealth(env: Bindings): ServiceHealth {
  return {
    service: 'gateway',
    status: 'ok',
    version: env.SERVICE_VERSION,
    latencyMs: 0,
  };
}

/**
 * Tries an internal service and turns any outcome into a state.
 * No error is propagated outward: details go to the log aggregator, the client
 * gets an anonymised status in the health report.
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
        error: `Service responded with HTTP ${response.status}`,
      });
    }

    const parsed = HealthResponseSchema.safeParse(await response.json());

    if (!parsed.success) {
      return finish({
        service: target.service,
        status: 'degraded',
        version: UNKNOWN_VERSION,
        error: 'Service response does not match HealthResponseSchema',
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
      error: cause instanceof Error ? cause.message : 'Unknown error calling the service',
    });
  }
}

export async function collectHealth(env: Bindings): Promise<ServiceHealth[]> {
  const probes = await Promise.all(HEALTH_TARGETS.map((target) => probeService(env, target)));

  return [selfHealth(env), ...probes];
}
