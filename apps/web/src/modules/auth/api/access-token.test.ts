import { describe, expect, it } from 'vitest';
import type { AuthGateway, AuthSession } from '../types/ports';
import { ACCESS_TOKEN_TTL_MS, createAccessToken } from './access-token';

/**
 * In-memory порт: кеш токена тестируется без React и без сети.
 * Методы, кроме accessToken, этому тесту не нужны, но тип требует порт целиком.
 */
class InMemoryAuthGateway implements AuthGateway {
  token: string | null = null;
  calls = 0;

  async accessToken(): Promise<string | null> {
    this.calls += 1;

    return this.token;
  }

  async signUp(): Promise<void> {
    throw new Error('не используется');
  }

  async signIn(): Promise<void> {
    throw new Error('не используется');
  }

  async signInWithProvider(): Promise<void> {
    throw new Error('не используется');
  }

  async signOut(): Promise<void> {
    throw new Error('не используется');
  }

  async currentSession(): Promise<AuthSession | null> {
    throw new Error('не используется');
  }
}

/** Порт с управляемым ответом: нужен, чтобы удержать запрос «в полёте». */
class DeferredAuthGateway extends InMemoryAuthGateway {
  private pending: ((token: string | null) => void) | null = null;

  override async accessToken(): Promise<string | null> {
    this.calls += 1;

    return new Promise((resolve) => {
      this.pending = resolve;
    });
  }

  resolve(token: string | null): void {
    this.pending?.(token);
    this.pending = null;
  }
}

describe('createAccessToken', () => {
  it('возвращает токен активной сессии', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.token = 'jwt-token';

    await expect(createAccessToken(gateway).execute()).resolves.toBe('jwt-token');
  });

  it('возвращает null без сессии', async () => {
    await expect(createAccessToken(new InMemoryAuthGateway()).execute()).resolves.toBeNull();
  });

  it('кеширует токен на TTL и не дёргает сервис повторно', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.token = 'jwt-token';
    let now = 1_000;
    const token = createAccessToken(gateway, () => now);

    await expect(token.execute()).resolves.toBe('jwt-token');
    now += ACCESS_TOKEN_TTL_MS - 1;
    await expect(token.execute()).resolves.toBe('jwt-token');
    expect(gateway.calls).toBe(1);
  });

  it('объединяет одновременные запросы токена в один in-flight промис', async () => {
    const gateway = new DeferredAuthGateway();
    const token = createAccessToken(gateway, () => 0);

    const first = token.execute();
    const second = token.execute();

    expect(gateway.calls).toBe(1);

    gateway.resolve('jwt-token');

    await expect(first).resolves.toBe('jwt-token');
    await expect(second).resolves.toBe('jwt-token');

    // Оба запроса получили один токен и после завершения он попал в кеш.
    await expect(token.execute()).resolves.toBe('jwt-token');
    expect(gateway.calls).toBe(1);
  });

  it('не возвращает в кеш ответ, начатый до clear()', async () => {
    const gateway = new DeferredAuthGateway();
    const token = createAccessToken(gateway, () => 0);

    const stale = token.execute();
    token.clear();
    gateway.resolve('stale-token');

    await expect(stale).resolves.toBe('stale-token');

    // После выхода старый ответ не должен «оживить» кеш: следующий вызов
    // обязан снова спросить auth-service.
    const fresh = token.execute();
    expect(gateway.calls).toBe(2);

    gateway.resolve('fresh-token');
    await expect(fresh).resolves.toBe('fresh-token');
  });

  it('обновляет токен после истечения TTL', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.token = 'jwt-first';
    let now = 0;
    const token = createAccessToken(gateway, () => now);

    await token.execute();
    gateway.token = 'jwt-second';
    now += ACCESS_TOKEN_TTL_MS + 1;

    await expect(token.execute()).resolves.toBe('jwt-second');
    expect(gateway.calls).toBe(2);
  });

  it('сбрасывает кеш по clear: после выхода токен спрашивают заново', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.token = 'jwt-token';
    const token = createAccessToken(gateway, () => 0);

    await token.execute();
    token.clear();

    await expect(token.execute()).resolves.toBe('jwt-token');
    expect(gateway.calls).toBe(2);
  });

  it('не кеширует отсутствие токена: выход из аккаунта не «прилипает»', async () => {
    const gateway = new InMemoryAuthGateway();
    const token = createAccessToken(gateway, () => 0);

    await expect(token.execute()).resolves.toBeNull();
    await expect(token.execute()).resolves.toBeNull();
    expect(gateway.calls).toBe(2);
  });
});
