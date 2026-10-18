import { INTERNAL_HEADERS } from '@notio/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { clientIdentifier, currentWindow, rateLimitKey } from '../src/middleware/rate-limit';
import { isValidRequestId } from '../src/middleware/request-id';
import {
  AUTHORIZATION,
  clientHeaders,
  createEnv,
  issueToken,
  problemOf,
  request,
  resetJwksCache,
} from './helpers';

/** Уникальный IP на тест: состояние KV переживает границы отдельных тестов. */
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;

  return `203.0.113.${ipCounter}`;
}

beforeEach(() => {
  resetJwksCache();
});

/** Заголовки авторизованного запроса к защищённому маршруту. */
async function authHeaders(): Promise<Record<string, string>> {
  return { ...AUTHORIZATION(await issueToken()), ...clientHeaders() };
}

describe('request-id', () => {
  it('генерирует идентификатор, если клиент его не прислал', async () => {
    const response = await request('/');

    expect(response.headers.get(INTERNAL_HEADERS.REQUEST_ID)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('принимает корректный идентификатор клиента', async () => {
    const response = await request('/', {
      headers: { [INTERNAL_HEADERS.REQUEST_ID]: 'req_from_client' },
    });

    expect(response.headers.get(INTERNAL_HEADERS.REQUEST_ID)).toBe('req_from_client');
  });

  it('выбрасывает идентификатор, не проходящий политику', async () => {
    const response = await request('/', {
      headers: { [INTERNAL_HEADERS.REQUEST_ID]: 'req from client!' },
    });

    expect(response.headers.get(INTERNAL_HEADERS.REQUEST_ID)).not.toBe('req from client!');
    expect(isValidRequestId('req\ninjected: header')).toBe(false);
  });

  it('пропускает только короткие безопасные значения', () => {
    expect(isValidRequestId('a-b_C9')).toBe(true);
    expect(isValidRequestId('a'.repeat(65))).toBe(false);
    expect(isValidRequestId('')).toBe(false);
    expect(isValidRequestId(undefined)).toBe(false);
  });
});

describe('security-заголовки', () => {
  it('задаёт защитные заголовки на каждом ответе', async () => {
    const response = await request('/');

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('задаёт защитные заголовки и на проксированных ответах', async () => {
    const response = await request('/api/pages', { headers: await authHeaders() }, createEnv());

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('не ставит HSTS на http, чтобы не сломать локальную разработку', async () => {
    const response = await request('/');

    expect(response.headers.get('strict-transport-security')).toBeNull();
  });
});

describe('CORS', () => {
  it('разрешает origin из allowlist', async () => {
    const response = await request('/', { headers: { origin: 'http://localhost:3000' } });

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('не отражает чужой origin', async () => {
    const response = await request('/', { headers: { origin: 'https://evil.example' } });

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('отвечает 204 на разрешённый префлайт и 403 на чужой', async () => {
    const allowed = await request('/api/pages', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    });
    const denied = await request('/api/pages', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    });

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toContain('PATCH');
    expect(denied.status).toBe(403);
  });
});

describe('rate limit', () => {
  it('считает запросы по идентификатору клиента и отдаёт 429 с Retry-After', async () => {
    const env = createEnv({ bindings: { RATE_LIMIT_MAX_REQUESTS: '3' } });
    const headers = await authHeaders();
    headers['cf-connecting-ip'] = uniqueIp();

    for (const _ of [1, 2, 3]) {
      const ok = await request('/api/unknown', { headers }, env);
      expect(ok.status).toBe(404);
    }

    const limited = await request('/api/unknown', { headers }, env);

    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(await problemOf(limited)).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('не ограничивает запросы с другого IP', async () => {
    const env = createEnv({ bindings: { RATE_LIMIT_MAX_REQUESTS: '3' } });

    for (const _ of [1, 2, 3, 4]) {
      const ip = uniqueIp();
      const response = await request(
        '/api/unknown',
        { headers: { ...(await authHeaders()), 'cf-connecting-ip': ip } },
        env,
      );

      expect(response.status).toBe(404);
    }
  });

  it('не ограничивает health-эндпоинты: мониторинг не должен ловить 429', async () => {
    const env = createEnv({ bindings: { RATE_LIMIT_MAX_REQUESTS: '2' } });

    for (const _ of [1, 2, 3, 4, 5]) {
      const response = await request('/health', undefined, env);
      expect(response.status).toBe(200);
    }
  });

  it('identifies клиента по cf-connecting-ip, а не по заголовку клиента', () => {
    const withCloudflareIp = new Request('https://gateway.notio.dev/', {
      headers: { 'cf-connecting-ip': '203.0.113.1' },
    });
    const withSpoofedHeader = new Request('https://gateway.notio.dev/', {
      headers: { 'x-forwarded-for': '1.1.1.1' },
    });

    expect(clientIdentifier(withCloudflareIp)).toBe('203.0.113.1');
    expect(clientIdentifier(withSpoofedHeader)).toBe('anonymous');
  });

  it('считает окно по времени, а не по счётчику запросов', () => {
    expect(currentWindow(60, 0)).toBe(0);
    expect(currentWindow(60, 59_999)).toBe(0);
    expect(currentWindow(60, 60_000)).toBe(1);
    expect(rateLimitKey('1.2.3.4', 7)).toBe('rl:7:1.2.3.4');
  });

  it('применяется ко всему /api/*, включая несуществующие маршруты', async () => {
    const env = createEnv({ bindings: { RATE_LIMIT_MAX_REQUESTS: '3' } });
    const headers = { 'cf-connecting-ip': uniqueIp() };

    for (const _ of [1, 2, 3]) {
      await request('/api/unknown', { headers }, env);
    }

    expect((await request('/api/unknown', { headers }, env)).status).toBe(429);
  });
});

describe('конфигурация', () => {
  it('не молча снимает защиту при некорректных лимитах', async () => {
    const env = createEnv({ bindings: { RATE_LIMIT_MAX_REQUESTS: '0' } });

    const response = await request('/health', undefined, env);

    expect(response.status).toBe(500);
  });

  it('не стартует с некорректным списком origin', async () => {
    const env = createEnv({ bindings: { CORS_ALLOWED_ORIGINS: 'не-url' } });

    const response = await request('/', undefined, env);

    expect(response.status).toBe(500);
  });

  it('использует уровень лога по умолчанию, если значение неизвестно', async () => {
    const env = createEnv({ bindings: { LOG_LEVEL: 'verbose' } });

    const response = await request('/', undefined, env);

    expect(response.status).toBe(200);
  });
});
