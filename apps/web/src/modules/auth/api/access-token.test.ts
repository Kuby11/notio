import { describe, expect, it } from 'vitest';
import type { AuthGateway, AuthSession } from '../types/ports';
import { ACCESS_TOKEN_TTL_MS, createAccessToken } from './access-token';

/**
 * In-memory port: the token cache is tested without React and without network.
 * Methods other than accessToken are not needed by this test, but the type requires the whole port.
 */
class InMemoryAuthGateway implements AuthGateway {
  updateUser = async () => {
    throw new Error('not implemented in test');
  };

  changeEmail = async () => {
    throw new Error('not implemented in test');
  };

  changePassword = async () => {
    throw new Error('not implemented in test');
  };

  deleteAccount = async () => {
    throw new Error('not implemented in test');
  };

  token: string | null = null;
  calls = 0;

  async accessToken(): Promise<string | null> {
    this.calls += 1;

    return this.token;
  }

  async signUp(): Promise<void> {
    throw new Error('not used in this test');
  }

  async signIn(): Promise<void> {
    throw new Error('not used in this test');
  }

  async signInWithProvider(): Promise<void> {
    throw new Error('not used in this test');
  }

  async signOut(): Promise<void> {
    throw new Error('not used in this test');
  }

  async currentSession(): Promise<AuthSession | null> {
    throw new Error('not used in this test');
  }
}

/** Port with a controlled response: needed to hold a request "in flight". */
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
  it('returns the token of an active session', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.token = 'jwt-token';

    await expect(createAccessToken(gateway).execute()).resolves.toBe('jwt-token');
  });

  it('returns null without a session', async () => {
    await expect(createAccessToken(new InMemoryAuthGateway()).execute()).resolves.toBeNull();
  });

  it('caches the token for the TTL and does not hit the service again', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.token = 'jwt-token';
    let now = 1_000;
    const token = createAccessToken(gateway, () => now);

    await expect(token.execute()).resolves.toBe('jwt-token');
    now += ACCESS_TOKEN_TTL_MS - 1;
    await expect(token.execute()).resolves.toBe('jwt-token');
    expect(gateway.calls).toBe(1);
  });

  it('merges concurrent token requests into one in-flight promise', async () => {
    const gateway = new DeferredAuthGateway();
    const token = createAccessToken(gateway, () => 0);

    const first = token.execute();
    const second = token.execute();

    expect(gateway.calls).toBe(1);

    gateway.resolve('jwt-token');

    await expect(first).resolves.toBe('jwt-token');
    await expect(second).resolves.toBe('jwt-token');

    // Both requests received one token and it landed in the cache once they settled.
    await expect(token.execute()).resolves.toBe('jwt-token');
    expect(gateway.calls).toBe(1);
  });

  it('does not cache a response started before clear()', async () => {
    const gateway = new DeferredAuthGateway();
    const token = createAccessToken(gateway, () => 0);

    const stale = token.execute();
    token.clear();
    gateway.resolve('stale-token');

    await expect(stale).resolves.toBe('stale-token');

    // After sign-out the old response must not "revive" the cache: the next call
    // has to ask auth-service again.
    const fresh = token.execute();
    expect(gateway.calls).toBe(2);

    gateway.resolve('fresh-token');
    await expect(fresh).resolves.toBe('fresh-token');
  });

  it('refreshes the token after the TTL expires', async () => {
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

  it('resets the cache on clear: after sign-out the token is fetched again', async () => {
    const gateway = new InMemoryAuthGateway();
    gateway.token = 'jwt-token';
    const token = createAccessToken(gateway, () => 0);

    await token.execute();
    token.clear();

    await expect(token.execute()).resolves.toBe('jwt-token');
    expect(gateway.calls).toBe(2);
  });

  it('does not cache a missing token: sign-out does not stick', async () => {
    const gateway = new InMemoryAuthGateway();
    const token = createAccessToken(gateway, () => 0);

    await expect(token.execute()).resolves.toBeNull();
    await expect(token.execute()).resolves.toBeNull();
    expect(gateway.calls).toBe(2);
  });
});
