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
  it('принимает корректное состояние сервиса', () => {
    expect(ServiceHealthSchema.parse(gateway)).toEqual(gateway);
  });

  it('отклоняет неизвестный сервис', () => {
    expect(() => ServiceHealthSchema.parse({ ...gateway, service: 'unknown-service' })).toThrow();
  });

  it('отклоняет неизвестный статус', () => {
    expect(() => ServiceHealthSchema.parse({ ...gateway, status: 'down' })).toThrow();
  });

  it('отклоняет отрицательную задержку', () => {
    expect(() => ServiceHealthSchema.parse({ ...gateway, latencyMs: -1 })).toThrow();
  });

  it('отклоняет пустую версию', () => {
    expect(() => ServiceHealthSchema.parse({ ...gateway, version: '' })).toThrow();
  });
});

describe('HealthResponseSchema', () => {
  it('принимает агрегированный ответ', () => {
    const payload = {
      status: 'ok',
      version: '0.1.0',
      timestamp: '2026-10-18T12:00:00.000Z',
      services: [gateway],
    };

    expect(HealthResponseSchema.parse(payload)).toEqual(payload);
  });

  it('отклоняет ответ без сервисов', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        version: '0.1.0',
        timestamp: '2026-10-18T12:00:00.000Z',
        services: [],
      }),
    ).toThrow();
  });

  it('отклоняет некорректный timestamp', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        version: '0.1.0',
        timestamp: 'вчера',
        services: [gateway],
      }),
    ).toThrow();
  });

  it('типизирует известные сервисы и статусы как литеральные объединения', () => {
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
  it('возвращает ok, когда все сервисы ok', () => {
    expect(aggregateStatus([gateway, { ...gateway, service: 'pages-service' }])).toBe('ok');
  });

  it('возвращает degraded, когда сервис упал', () => {
    expect(aggregateStatus([gateway, degradedPages])).toBe('degraded');
  });

  it('не деградирует из-за пустого списка сервисов', () => {
    expect(aggregateStatus([])).toBe('ok');
  });
});

describe('healthStatusCode', () => {
  it('отдаёт 200 для ok и 503 для degraded', () => {
    expect(healthStatusCode('ok')).toBe(200);
    expect(healthStatusCode('degraded')).toBe(503);
  });
});
