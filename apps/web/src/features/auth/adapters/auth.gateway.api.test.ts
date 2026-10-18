import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '../domain';
import { createBetterAuthGateway } from './auth.gateway.api';
import {
  AuthErrorResponseSchema,
  SessionResponseSchema,
  SignUpResponseSchema,
  TokenResponseSchema,
} from './auth.dto';
import { authErrorFromPayload, authErrorFromStatus, messageFor } from './auth.error-mapper';

const BASE_URL = 'http://localhost:8787';

/**
 * Контрактный тест адаптера: клиент Better Auth работает поверх fetch,
 * поэтому сетевой слой подменяется целиком — проверяется наш код, а не библиотека.
 */
function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
    async (input, init) => handler(String(input), init),
  );

  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const USER = {
  id: 'user-1',
  email: 'user@notio.dev',
  name: 'Аня',
  emailVerified: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('адаптер аутентификации', () => {
  it('проверяет ответ регистрации Zod-схемой', async () => {
    stubFetch(() => json({ token: null, user: USER }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signUp({ name: 'Аня', email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).resolves.toBeUndefined();
  });

  it('не пропускает ответ без обязательных полей', async () => {
    stubFetch(() => json({ token: null, user: { id: 'user-1' } }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signUp({ name: 'Аня', email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toThrow();
  });

  it('переводит отказ по неверному паролю в доменную ошибку', async () => {
    stubFetch(() =>
      json({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' }, 401),
    );
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'wrong-password' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('переводит неподтверждённую почту в доменную ошибку', async () => {
    stubFetch(() => json({ code: 'EMAIL_NOT_VERIFIED' }, 403));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
  });

  it('переводит превышение лимита в RATE_LIMITED', async () => {
    stubFetch(() => json({ message: 'Too many requests' }, 429));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('превращает обрыв сети в NETWORK_ERROR, а не в «неверный пароль»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('возвращает null, когда сессии нет', async () => {
    stubFetch(() => json(null));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.currentSession()).resolves.toBeNull();
  });

  it('возвращает сессию активного пользователя', async () => {
    stubFetch(() =>
      json({
        user: USER,
        session: { id: 'session-1', expiresAt: '2026-10-19T00:00:00.000Z' },
      }),
    );
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    const session = await gateway.currentSession();

    expect(session?.user.email).toBe('user@notio.dev');
    expect(session?.expiresAt).toBe('2026-10-19T00:00:00.000Z');
  });

  it('возвращает null, если ответ сессии не соответствует контракту', async () => {
    stubFetch(() => json({ user: { id: 'user-1' }, session: { id: 'session-1' } }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.currentSession()).resolves.toBeNull();
  });

  it('запрашивает JWT у сервиса и отдаёт строку токена', async () => {
    const fetchMock = stubFetch(() => json({ token: 'jwt-token' }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.accessToken()).resolves.toBe('jwt-token');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/auth/token');
    expect(TokenResponseSchema.safeParse({ token: 'jwt-token' }).success).toBe(true);
  });

  it('не путает сетевой сбой с «нет сессии»: токен просто null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.accessToken()).resolves.toBeNull();
  });

  it('возвращает null, если сервис не выдал токен', async () => {
    stubFetch(() => json({}, 401));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.accessToken()).resolves.toBeNull();
  });

  it('возвращает null, если ответ не соответствует схеме токена', async () => {
    stubFetch(() => json({ token: '' }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.accessToken()).resolves.toBeNull();
  });

  it('превращает неожиданный код ошибки в UNKNOWN', async () => {
    stubFetch(() => json({ code: 'SOMETHING_UNEXPECTED' }, 500));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('не теряет сетевую ошибку при выходе из аккаунта', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.signOut()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('ходит только по адресу gateway', async () => {
    const fetchMock = stubFetch(() => json({ token: 'jwt-token' }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await gateway.accessToken();

    expect(String(fetchMock.mock.calls[0]?.[0]).startsWith(BASE_URL)).toBe(true);
  });
});

describe('перевод кодов ошибок', () => {
  it.each([
    ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'EMAIL_TAKEN'],
    ['EMAIL_TAKEN', 'EMAIL_TAKEN'],
    ['PASSWORD_TOO_SHORT', 'WEAK_PASSWORD'],
    ['PASSWORD_TOO_LONG', 'WEAK_PASSWORD'],
    ['INVALID_EMAIL', 'INVALID_EMAIL'],
    ['INVALID_CREDENTIALS', 'INVALID_CREDENTIALS'],
  ])('переводит %s в %s', async (serviceCode, expected) => {
    stubFetch(() => json({ code: serviceCode }, 400));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: expected });
  });

  it('остаётся UNKNOWN без кода и статуса', () => {
    expect(authErrorFromPayload({}).code).toBe('UNKNOWN');
  });

  it('считает 429 ограничением по частоте', () => {
    expect(authErrorFromStatus(429).code).toBe('RATE_LIMITED');
    expect(authErrorFromStatus(500).code).toBe('UNKNOWN');
    expect(messageFor('INVALID_CREDENTIALS')).toContain('пароль');
  });
});

describe('DTO-схемы', () => {
  it('не принимает ответ без идентификатора пользователя', () => {
    expect(
      SignUpResponseSchema.safeParse({ token: null, user: { email: 'user@notio.dev' } }).success,
    ).toBe(false);
  });

  it('считает пустой ответ сессии валидным «нет сессии»', () => {
    expect(SessionResponseSchema.safeParse(null).success).toBe(true);
  });

  it('принимает ошибку без кода и статуса', () => {
    expect(AuthErrorResponseSchema.safeParse({}).success).toBe(true);
  });
});

describe('ошибки аутентификации', () => {
  it('наследует Error и хранит код', () => {
    const error = new AuthError('RATE_LIMITED', 'Слишком много попыток');

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('RATE_LIMITED');
  });
});
