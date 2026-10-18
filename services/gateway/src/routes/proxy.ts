import {
  GATEWAY_SOURCE,
  INTERNAL_HEADERS,
  problem,
  SERVICE_RESPONSE_HEADER,
} from '@notio/contracts';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv, Bindings } from '../env';

/** Куда gateway проксирует запросы: публичный префикс → корень в сервисе. */
export interface ProxyTarget {
  /** Публичный префикс gateway, например /api/pages. */
  prefix: string;
  /** Корень маршрутов внутри сервиса, например /pages. */
  serviceRoot: string;
  /** Имя биндинга Service Binding. */
  binding: 'PAGES_SERVICE';
  /** Человекочитаемое имя сервиса для логов и заголовка ответа. */
  service: string;
}

export const PROXY_TARGETS = [
  {
    prefix: '/api/pages',
    serviceRoot: '/pages',
    binding: 'PAGES_SERVICE',
    service: 'pages-service',
  },
] as const satisfies readonly ProxyTarget[];

/** Заголовки, которые нельзя пересылать между воркерами. */
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

/** Заголовки ответа, которые имеет смысл отдавать клиенту. */
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control', 'retry-after'] as const;

/**
 * Идентификатор пользователя для сервисов.
 *
 * На Этапе 1 подписи ещё нет (auth-service — Этап 2), поэтому вне разработки
 * значение не принимается: gateway предпочитает «не знаю», и сервис отвечает 403.
 * Это осознанный fail closed, а не заглушка.
 */
export function actorIdFromRequest(env: Bindings, request: Request): string | undefined {
  if (env.ENVIRONMENT === 'production') {
    return undefined;
  }

  return request.headers.get('x-actor-id') ?? undefined;
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Проксирует публичный префикс в сервис через Service Binding.
 *
 * Важно: внутренние заголовки gateway **перезаписывает**, а не пересылает.
 * Иначе клиент пришлёт `x-user-id` от чужого пользователя и будет действовать
 * от его имени.
 */
export function proxyToService(target: ProxyTarget): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!matchesPrefix(c.req.path, target.prefix)) {
      await next();
      return;
    }

    const requestId = c.get('requestId');
    const incomingUrl = new URL(c.req.url);
    const suffix = c.req.path.slice(target.prefix.length);
    const targetUrl = `${incomingUrl.origin}${target.serviceRoot}${suffix}${incomingUrl.search}`;

    const headers = new Headers();
    for (const [name, value] of c.req.raw.headers.entries()) {
      const lowerName = name.toLowerCase();

      if (
        HOP_BY_HOP_HEADERS.has(lowerName) ||
        lowerName === INTERNAL_HEADERS.ACTOR_ID ||
        lowerName === INTERNAL_HEADERS.REQUEST_ID ||
        lowerName === INTERNAL_HEADERS.SOURCE_SERVICE
      ) {
        continue;
      }

      headers.set(name, value);
    }

    headers.set(INTERNAL_HEADERS.REQUEST_ID, requestId);
    headers.set(INTERNAL_HEADERS.SOURCE_SERVICE, GATEWAY_SOURCE);

    const actorId = actorIdFromRequest(c.env, c.req.raw);
    if (actorId) {
      headers.set(INTERNAL_HEADERS.ACTOR_ID, actorId);
    }

    const hasBody = c.req.method !== 'GET' && c.req.method !== 'HEAD';

    try {
      const upstream = await c.env[target.binding].fetch(
        new Request(targetUrl, {
          method: c.req.method,
          headers,
          body: hasBody ? c.req.raw.body : null,
          redirect: 'manual',
        }),
      );

      const responseHeaders = new Headers({ [SERVICE_RESPONSE_HEADER]: target.service });
      for (const name of FORWARDED_RESPONSE_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) {
          responseHeaders.set(name, value);
        }
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch {
      return problem({
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        detail: `Сервис ${target.service} недоступен`,
        requestId,
      });
    }
  };
}
