import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '../types/errors';
import { createBetterAuthGateway } from './auth.api';
import {
  AuthErrorResponseSchema,
  SessionResponseSchema,
  SignUpResponseSchema,
  TokenResponseSchema,
} from '../types/dto';
import { authErrorFromPayload, authErrorFromStatus } from '../utils/error-mapper';

const BASE_URL = 'http://localhost:8787';

/**
 * Contract test of the adapter: the Better Auth client runs over fetch, so the
 * network layer is replaced entirely — our code is checked, not the library.
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
  name: 'Anna',
  emailVerified: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth adapter', () => {
  it('validates the sign-up response with a Zod schema', async () => {
    stubFetch(() => json({ token: null, user: USER }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signUp({ name: 'Anna', email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).resolves.toBeUndefined();
  });

  it('rejects a response missing required fields', async () => {
    stubFetch(() => json({ token: null, user: { id: 'user-1' } }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signUp({ name: 'Anna', email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toThrow();
  });

  it('maps an invalid-password rejection to a domain error', async () => {
    stubFetch(() =>
      json({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' }, 401),
    );
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'wrong-password' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('maps an unverified email to a domain error', async () => {
    stubFetch(() => json({ code: 'EMAIL_NOT_VERIFIED' }, 403));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
  });

  it('maps rate limiting to RATE_LIMITED', async () => {
    stubFetch(() => json({ message: 'Too many requests' }, 429));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('maps our 409 about a taken email to EMAIL_TAKEN', async () => {
    stubFetch(() =>
      json(
        {
          status: 409,
          code: 'CONFLICT',
          detail: 'An account with this email already exists',
          requestId: 'req-1',
        },
        409,
      ),
    );
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signUp({ name: 'Anna', email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
  });

  it('turns a network drop into NETWORK_ERROR, not invalid credentials', async () => {
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

  it('after a profile update returns state from the session, not the response body', async () => {
    // update-user answers `{ status: true }` — parsing used to fail on it.
    const fetchMock = stubFetch((url) => {
      if (url.includes('/update-user')) {
        return json({ status: true });
      }

      return json({
        user: { ...USER, name: 'Vanya' },
        session: { id: 'session-1', expiresAt: '2026-10-19T00:00:00.000Z' },
      });
    });
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    const user = await gateway.updateUser({ name: 'Vanya' });

    expect(user.name).toBe('Vanya');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/update-user'))).toBe(true);
  });

  it('fails if the session is gone after a profile update', async () => {
    stubFetch((url) => (url.includes('/update-user') ? json({ status: true }) : json(null)));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.updateUser({ name: 'Vanya' })).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('submits the email change request and does not expect a user body', async () => {
    const fetchMock = stubFetch(() => json({ status: true }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.changeEmail('new@notio.dev')).resolves.toBeUndefined();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/auth/change-email');
  });

  it('sends the new password to the session endpoint without the current password', async () => {
    const fetchMock = stubFetch(() => json({ status: true }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.changePassword({ newPassword: 'new-password-34' }),
    ).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] ?? [];

    expect(String(url)).toContain('/api/auth/change-password/session');
    expect(JSON.parse(String(init?.body))).toEqual({ newPassword: 'new-password-34' });
  });

  it('explains that an OAuth account has no password', async () => {
    stubFetch(() => json({ code: 'CREDENTIAL_ACCOUNT_NOT_FOUND' }, 400));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.changePassword({ newPassword: 'new-password-34' })).rejects.toMatchObject({
      code: 'PASSWORD_NOT_SET',
    });
  });

  it('asks to sign in again when the session is too stale for deletion', async () => {
    stubFetch(() => json({ code: 'SESSION_NOT_FRESH' }, 403));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.deleteAccount()).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  });

  it('deletes the account via delete-user', async () => {
    const fetchMock = stubFetch(() => json({ success: true, message: 'User deleted' }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.deleteAccount()).resolves.toBeUndefined();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/auth/delete-user');
  });

  it('returns null when there is no session', async () => {
    stubFetch(() => json(null));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.currentSession()).resolves.toBeNull();
  });

  it('returns the session of an active user', async () => {
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

  it('returns null when the session response breaks the contract', async () => {
    stubFetch(() => json({ user: { id: 'user-1' }, session: { id: 'session-1' } }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.currentSession()).resolves.toBeNull();
  });

  it('requests a JWT from the service and returns the token string', async () => {
    const fetchMock = stubFetch(() => json({ token: 'jwt-token' }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.accessToken()).resolves.toBe('jwt-token');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/auth/token');
    expect(TokenResponseSchema.safeParse({ token: 'jwt-token' }).success).toBe(true);
  });

  it('does not confuse a network failure with no session: the token is just null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.accessToken()).resolves.toBeNull();
  });

  it('returns null when the service did not issue a token', async () => {
    stubFetch(() => json({}, 401));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.accessToken()).resolves.toBeNull();
  });

  it('returns null when the response does not match the token schema', async () => {
    stubFetch(() => json({ token: '' }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.accessToken()).resolves.toBeNull();
  });

  it('maps an unexpected error code to UNKNOWN', async () => {
    stubFetch(() => json({ code: 'SOMETHING_UNEXPECTED' }, 500));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('does not swallow the network error when signing out', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(gateway.signOut()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('only talks to the gateway address', async () => {
    const fetchMock = stubFetch(() => json({ token: 'jwt-token' }));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await gateway.accessToken();

    expect(String(fetchMock.mock.calls[0]?.[0]).startsWith(BASE_URL)).toBe(true);
  });

  it('keeps auth requests on the app origin when the base URL is empty', async () => {
    const fetchMock = stubFetch(() => json({ token: 'jwt-token' }));
    const gateway = createBetterAuthGateway({ baseUrl: '' });

    await expect(gateway.accessToken()).resolves.toBe('jwt-token');
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/auth/token');
  });
});

describe('error code mapping', () => {
  it.each([
    ['USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', 'EMAIL_TAKEN'],
    ['EMAIL_TAKEN', 'EMAIL_TAKEN'],
    ['PASSWORD_TOO_SHORT', 'WEAK_PASSWORD'],
    ['PASSWORD_TOO_LONG', 'WEAK_PASSWORD'],
    ['INVALID_EMAIL', 'INVALID_EMAIL'],
    ['INVALID_CREDENTIALS', 'INVALID_CREDENTIALS'],
  ])('maps %s to %s', async (serviceCode, expected) => {
    stubFetch(() => json({ code: serviceCode }, 400));
    const gateway = createBetterAuthGateway({ baseUrl: BASE_URL });

    await expect(
      gateway.signIn({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).rejects.toMatchObject({ code: expected });
  });

  it('stays UNKNOWN without a code or status', () => {
    expect(authErrorFromPayload({}).code).toBe('UNKNOWN');
  });

  it('treats 429 as rate limiting', () => {
    expect(authErrorFromStatus(429).code).toBe('RATE_LIMITED');
    expect(authErrorFromStatus(500).code).toBe('UNKNOWN');
    expect(authErrorFromStatus(500).message).toBe('UNKNOWN');
  });
});

describe('DTO schemas', () => {
  it('rejects a response without a user id', () => {
    expect(
      SignUpResponseSchema.safeParse({ token: null, user: { email: 'user@notio.dev' } }).success,
    ).toBe(false);
  });

  it('accepts an empty session response as a valid no-session', () => {
    expect(SessionResponseSchema.safeParse(null).success).toBe(true);
  });

  it('accepts an error without a code or status', () => {
    expect(AuthErrorResponseSchema.safeParse({}).success).toBe(true);
  });
});

describe('auth errors', () => {
  it('extends Error and carries a code', () => {
    const error = new AuthError('RATE_LIMITED', 'Too many attempts');

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('RATE_LIMITED');
  });
});
