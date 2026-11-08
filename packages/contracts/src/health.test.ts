import { describe, expect, it } from 'vitest';
import {
  aggregateStatus,
  HEALTH_STATUSES,
  HealthResponseSchema,
  healthStatusCode,
  SERVICE_NAMES,
  ServiceHealthSchema,
  UNKNOWN_VERSION,
  type ServiceHealth,
} from './health';

const gateway: ServiceHealth = {
  service: 'gateway',
  status: 'ok',
  version: '0.1.0',
  latencyMs: 0,
};

const degradedPages: ServiceHealth = {
  service: 'pages-service',
  status: 'degraded',
  version: UNKNOWN_VERSION,
  latencyMs: 12,
  error: 'HTTP 500',
};

describe('ServiceHealthSchema', () => {
  it('accepts a valid service state', () => {
    expect(ServiceHealthSchema.parse(gateway)).toEqual(gateway);
  });

  it('rejects an unknown service', () => {
    expect(() => ServiceHealthSchema.parse({ ...gateway, service: 'unknown-service' })).toThrow();
  });

  it('rejects an unknown status', () => {
    expect(() => ServiceHealthSchema.parse({ ...gateway, status: 'down' })).toThrow();
  });

  it('rejects a negative latency', () => {
    expect(() => ServiceHealthSchema.parse({ ...gateway, latencyMs: -1 })).toThrow();
  });

  it('rejects an empty version', () => {
    expect(() => ServiceHealthSchema.parse({ ...gateway, version: '' })).toThrow();
  });
});

describe('HealthResponseSchema', () => {
  it('accepts an aggregated response', () => {
    const payload = {
      status: 'ok',
      version: '0.1.0',
      timestamp: '2026-10-18T12:00:00.000Z',
      services: [gateway],
    };

    expect(HealthResponseSchema.parse(payload)).toEqual(payload);
  });

  it('rejects a response without services', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        version: '0.1.0',
        timestamp: '2026-10-18T12:00:00.000Z',
        services: [],
      }),
    ).toThrow();
  });

  it('rejects an invalid timestamp', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        version: '0.1.0',
        timestamp: 'yesterday',
        services: [gateway],
      }),
    ).toThrow();
  });

  it('types known services and statuses as literal unions', () => {
    expect(SERVICE_NAMES).toEqual([
      'gateway',
      'pages-service',
      'auth-service',
      'workspace-service',
      'media-service',
    ]);
    expect(HEALTH_STATUSES).toEqual(['ok', 'degraded']);
  });
});

describe('aggregateStatus', () => {
  it('returns ok when all services are ok', () => {
    expect(aggregateStatus([gateway, { ...gateway, service: 'pages-service' }])).toBe('ok');
  });

  it('returns degraded when a service is down', () => {
    expect(aggregateStatus([gateway, degradedPages])).toBe('degraded');
  });

  it('does not degrade on an empty service list', () => {
    expect(aggregateStatus([])).toBe('ok');
  });
});

describe('healthStatusCode', () => {
  it('returns 200 for ok and 503 for degraded', () => {
    expect(healthStatusCode('ok')).toBe(200);
    expect(healthStatusCode('degraded')).toBe(503);
  });
});
