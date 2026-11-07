import {
  GATEWAY_SOURCE,
  INTERNAL_HEADERS,
  problem,
  SERVICE_RESPONSE_HEADER,
} from '@notio/contracts';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/** Where the gateway proxies requests: public prefix -> service root. */
export interface ProxyTarget {
  /** Public gateway prefix, e.g. /api/pages. */
  prefix: string;
  /** Root of the routes inside the service, e.g. /pages. */
  serviceRoot: string;
  binding: 'PAGES_SERVICE' | 'AUTH_SERVICE' | 'WORKSPACE_SERVICE' | 'MEDIA_SERVICE';
  /** Human-readable service name for logs and the response header. */
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
    // Page blocks live in pages-service, but the public prefix is separate:
    // the frontend needs block operations by id without pageId in the path.
    prefix: '/api/blocks',
    serviceRoot: '/blocks',
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
    // Databases belong to workspace-service: tables, rows and views live in
    // the same D1 database and the same permission model.
    prefix: '/api/databases',
    serviceRoot: '/databases',
    binding: 'WORKSPACE_SERVICE',
    service: 'workspace-service',
  },
  {
    prefix: '/api/database-rows',
    serviceRoot: '/database-rows',
    binding: 'WORKSPACE_SERVICE',
    service: 'workspace-service',
  },
  {
    prefix: '/api/database-views',
    serviceRoot: '/database-views',
    binding: 'WORKSPACE_SERVICE',
    service: 'workspace-service',
  },
  {
    prefix: '/api/media',
    serviceRoot: '/media',
    binding: 'MEDIA_SERVICE',
    service: 'media-service',
  },
  {
    // Invitations are accepted by token, so they get their own public prefix:
    // a stranger does not need the shape of the workspace structure.
    prefix: '/api/invitations',
    serviceRoot: '/invitations',
    binding: 'WORKSPACE_SERVICE',
    service: 'workspace-service',
  },
] as const satisfies readonly ProxyTarget[];

/** Headers that must not be forwarded between workers. */
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

/** Response headers worth sending to the client. */
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'cache-control',
  'retry-after',
  'location',
  // Media files: the file block needs size and name (HEAD), Range is for video.
  'content-length',
  'content-disposition',
  'etag',
  'accept-ranges',
  'content-range',
] as const;

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * User identity for the internal services.
 *
 * Taken only from the signed token verified by the JWT middleware. The client's
 * `x-user-id` header is discarded: otherwise anyone reaching the gateway could
 * declare themselves to be another user.
 */
export function userIdFromRequest(c: {
  get: (key: 'user') => AppEnv['Variables']['user'];
}): string | undefined {
  return c.get('user')?.id;
}

/**
 * Proxies the public prefix into the service through a Service Binding.
 *
 * Gateway internal headers are overwritten, never forwarded.
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

      // The session cookie is returned to the client as is: otherwise sign-in would not stick.
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
