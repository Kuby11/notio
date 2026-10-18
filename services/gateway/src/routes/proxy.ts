import {
  GATEWAY_SOURCE,
  INTERNAL_HEADERS,
  problem,
  SERVICE_RESPONSE_HEADER,
} from '@notio/contracts';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/** Куда gateway проксирует запросы: публичный префикс → корень в сервисе. */
export interface ProxyTarget {
  /** Публичный префикс gateway, например /api/pages. */
  prefix: string;
  /** Корень маршрутов внутри сервиса, например /pages. */
  serviceRoot: string;
  /** Имя биндинга Service Binding. */
  binding: 'PAGES_SERVICE' | 'AUTH_SERVICE' | 'WORKSPACE_SERVICE';
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
  {
    prefix: '/api/auth',
    serviceRoot: '/api/auth',
    binding: 'AUTH_SERVICE',
    service: 'auth-service',
  },
  {
    prefix: '/api/workspaces',
    serviceRoot: '/workspaces',
    binding: 'WORKSPACE_SERVICE',
    service: 'workspace-service',
  },
  {
    // Приглашения принимают по токену, поэтому у них свой публичный префикс:
    // структура workspace постороннему пользователю не нужна.
    prefix: '/api/invitations',
    serviceRoot: '/invitations',
    binding: 'WORKSPACE_SERVICE',
    service: 'workspace-service',
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

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Идентичность пользователя для внутренних сервисов.
 *
 * Берётся только из подписанного токена, проверенного middleware JWT.
 * Заголовок клиента `x-user-id` отбрасывается: иначе любой, кто достучался
 * до gateway, объявил бы себя другим пользователем.
 */
export function userIdFromRequest(c: {
  get: (key: 'user') => AppEnv['Variables']['user'];
}): string | undefined {
  return c.get('user')?.id;
}

/**
 * Проксирует публичный префикс в сервис через Service Binding.
 *
 * Внутренние заголовки gateway перезаписывает, а не пересылает.
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

    const userId = userIdFromRequest(c);
    if (userId) {
      headers.set(INTERNAL_HEADERS.ACTOR_ID, userId);
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

        if (value !== null) {
          responseHeaders.set(name, value);
        }
      }

      // Cookie сессии возвращается клиенту как есть: иначе вход не сохранится.
      for (const cookie of upstream.headers.getSetCookie()) {
        responseHeaders.append('set-cookie', cookie);
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
