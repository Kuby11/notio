import { NextResponse, type NextRequest } from 'next/server';

/**
 * Проверка сессии до рендера страниц приложения.
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
    // Откуда пришли: после входа возвращаем пользователя на нужную страницу.
    loginUrl.searchParams.set('next', pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
