import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy (бывший middleware): проверка сессии до рендера страниц приложения.
 *
 * Локаль next-intl здесь не участвует: язык хранится в cookie NEXT_LOCALE и
 * читается в i18n/request.ts. URL не переписывается на /ru/... — префиксов
 * локалей в приложении нет.
 *
 * Proxy смотрит только наличие cookie: настоящая проверка подписи и прав
 * выполняется на gateway. Скрытие страницы здесь — UX, а не защита.
 */

const SESSION_COOKIE = 'notio.session_token';
const PUBLIC_PREFIXES = ['/login', '/register', '/api/auth'] as const;

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);

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
