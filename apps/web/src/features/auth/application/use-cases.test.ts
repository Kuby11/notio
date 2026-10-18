import { describe, expect, it } from 'vitest';
import { AuthError } from '../domain';
import type { AuthGateway, AuthSession, SignUpInput } from './ports';
import type { Credentials } from '../domain';
import { AccessToken } from './access-token';
import { CurrentSession } from './current-session';
import { SignIn } from './sign-in';
import { SignOut } from './sign-out';
import { SignUp } from './sign-up';

/**
 * In-memory порт: use cases тестируются без React и без сети.
 * Поведение повторяет контракт адаптера: отказ по коду, сессия или null.
 */
class InMemoryAuthGateway implements AuthGateway {
  readonly calls: string[] = [];
  signUpError: AuthError | null = null;
  signInError: AuthError | null = null;
  signOutError: AuthError | null = null;
  session: AuthSession | null = null;
  token: string | null = null;
  lastSignUp: SignUpInput | null = null;
  lastSignIn: Credentials | null = null;

  async signUp(input: SignUpInput): Promise<void> {
    this.calls.push('signUp');
    this.lastSignUp = input;

    if (this.signUpError !== null) {
      throw this.signUpError;
    }
  }

  async signIn(credentials: Credentials): Promise<void> {
    this.calls.push('signIn');
    this.lastSignIn = credentials;

    if (this.signInError !== null) {
      throw this.signInError;
    }
  }

  async signOut(): Promise<void> {
    this.calls.push('signOut');

    if (this.signOutError !== null) {
      throw this.signOutError;
    }
  }

  async currentSession(): Promise<AuthSession | null> {
    this.calls.push('currentSession');

    return this.session;
  }

  async accessToken(): Promise<string | null> {
    this.calls.push('accessToken');

    return this.token;
  }
}

const CREDENTIALS: Credentials = { email: 'user@notio.dev', password: 'correct-horse-battery' };

describe('SignUp', () => {
  it('нормализует почту и имя перед отправкой', async () => {
    const gateway = new InMemoryAuthGateway();

    await new SignUp(gateway).execute({
      name: ' Аня ',
      email: '  User@Notio.DEV ',
      password: CREDENTIALS.password,
    });

    expect(gateway.lastSignUp).toEqual({
      name: 'Аня',
      email: 'user@notio.dev',
      password: CREDENTIALS.password,
    });
  });

  it('не ходит в сеть, если данные некорректны', async () => {
    const gateway = new InMemoryAuthGateway();

    await expect(
      new SignUp(gateway).execute({ name: 'Аня', email: 'nope', password: 'short' }),
    ).rejects.toThrow(AuthError);
    expect(gateway.calls).toEqual([]);
  });

  it('не регистрирует пользователя без имени', async () => {
    const gateway = new InMemoryAuthGateway();

    await expect(
      new SignUp(gateway).execute({
        name: ' ',
        email: 'user@notio.dev',
        password: CREDENTIALS.password,
      }),
    ).rejects.toThrow(/Имя/);
    expect(gateway.calls).toEqual([]);
  });

  it('пробрасывает ошибку сервиса', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.signUpError = new AuthError('EMAIL_TAKEN', 'Аккаунт существует');

    await expect(new SignUp(gateway).execute({ name: 'Аня', ...CREDENTIALS })).rejects.toThrow(
      'Аккаунт существует',
    );
  });
});

describe('SignIn', () => {
  it('нормализует почту перед входом', async () => {
    const gateway = new InMemoryAuthGateway();

    await new SignIn(gateway).execute({ email: 'USER@notio.dev', password: CREDENTIALS.password });

    expect(gateway.lastSignIn?.email).toBe('user@notio.dev');
  });

  it('не путает слабый пароль при входе с неверными данными', async () => {
    const gateway = new InMemoryAuthGateway();

    await expect(
      new SignIn(gateway).execute({ email: 'user@notio.dev', password: 'short' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('отличает некорректную почту', async () => {
    const gateway = new InMemoryAuthGateway();

    await expect(
      new SignIn(gateway).execute({ email: 'nope', password: CREDENTIALS.password }),
    ).rejects.toMatchObject({ code: 'INVALID_EMAIL' });
  });

  it('передаёт отказ по неподтверждённой почте пользователю', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.signInError = new AuthError('EMAIL_NOT_VERIFIED', 'Подтвердите почту');

    await expect(new SignIn(gateway).execute(CREDENTIALS)).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
    });
  });
});

describe('SignOut', () => {
  it('обращается к порту', async () => {
    const gateway = new InMemoryAuthGateway();

    await new SignOut(gateway).execute();

    expect(gateway.calls).toEqual(['signOut']);
  });

  it('не скрывает сетевую ошибку: выход не «успешный»', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.signOutError = new AuthError('NETWORK_ERROR', 'Сервис недоступен');

    await expect(new SignOut(gateway).execute()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});

describe('CurrentSession', () => {
  it('возвращает null, если пользователь не вошёл', async () => {
    await expect(new CurrentSession(new InMemoryAuthGateway()).execute()).resolves.toBeNull();
  });

  it('возвращает сессию активного пользователя', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.session = {
      user: { id: 'user-1', email: 'user@notio.dev', name: 'Аня', emailVerified: true },
      expiresAt: '2026-10-19T00:00:00.000Z',
    };

    await expect(new CurrentSession(gateway).execute()).resolves.toEqual(gateway.session);
  });
});

describe('AccessToken', () => {
  it('возвращает токен активной сессии', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.token = 'jwt-token';

    await expect(new AccessToken(gateway).execute()).resolves.toBe('jwt-token');
  });

  it('возвращает null без сессии', async () => {
    await expect(new AccessToken(new InMemoryAuthGateway()).execute()).resolves.toBeNull();
  });
});
