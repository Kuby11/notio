import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy (formerly middleware): session check before app pages render.
 *
 * next-intl locale plays no part here: the language lives in the NEXT_LOCALE cookie
 * and is read in i18n/request.ts. URLs are not rewritten to /ru/...: there are
 * no locale prefixes in the app.
 *
 * Proxy only checks that the cookie exists: real signature and permission checks
 * happen on the gateway. Hiding a page here is UX, not security.
 */

// Production cookies carry the __Secure- prefix (better-auth adds it when
// useSecureCookies is on); dev issues the bare name. Both are accepted.
const SESSION_COOKIES = ['notio.session_token', '__Secure-notio.session_token'] as const;
const PUBLIC_PREFIXES = ['/login', '/register', '/api/auth'] as const;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\..*).*)'],
};
