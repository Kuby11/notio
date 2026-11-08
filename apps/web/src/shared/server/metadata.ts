import { cookies } from 'next/headers';
import { env } from '../configs/env';

/**
 * Server-side title lookups for `generateMetadata`.
 *
 * The route knows only ids; the session lives in an httpOnly cookie that
 * JavaScript cannot read. The cookie is exchanged for a JWT at the gateway
 * and the JWT authorizes the lookup. Any failure — no session, network
 * error, unexpected response — returns null, and the route falls back to
 * the layout's default title instead of failing the render.
 */

async function fetchAuthorized(path: string): Promise<unknown | null> {
  const cookieHeader = (await cookies()).toString();

  if (cookieHeader.length === 0) {
    return null;
  }

  const tokenResponse = await fetch(`${env.NEXT_PUBLIC_GATEWAY_URL}/api/auth/token`, {
    headers: { cookie: cookieHeader },
    cache: 'no-store',
  });

  if (!tokenResponse.ok) {
    return null;
  }

  const tokenPayload = (await tokenResponse.json().catch(() => null)) as { token?: unknown } | null;

  if (typeof tokenPayload?.token !== 'string' || tokenPayload.token.length === 0) {
    return null;
  }

  const response = await fetch(`${env.NEXT_PUBLIC_GATEWAY_URL}${path}`, {
    headers: { authorization: `Bearer ${tokenPayload.token}` },
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  return response.json().catch(() => null);
}

function readStringField(data: unknown, field: string): string | null {
  const value = (data as Record<string, unknown> | null)?.[field];

  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The current page's title, or null when it cannot be read. */
export async function fetchPageTitle(workspaceId: string, pageId: string): Promise<string | null> {
  const data = await fetchAuthorized(`/api/pages/${pageId}?workspaceId=${workspaceId}`);

  return readStringField(data, 'title');
}

/** The current workspace's name, or null when it cannot be read. */
export async function fetchWorkspaceName(workspaceId: string): Promise<string | null> {
  const data = await fetchAuthorized(`/api/workspaces/${workspaceId}`);

  return readStringField(data, 'name');
}
