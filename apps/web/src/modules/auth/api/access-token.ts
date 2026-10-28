import type { TokenProvider } from '../../../shared/types';
import type { AuthGateway } from '../types/ports';

/**
 * api infrastructure: the active session's JWT with an in-memory cache.
 *
 * The provider lives outside React: the container passes it to other modules'
 * repositories as a `TokenProvider`. The token is never stored in browser
 * storage. The cache exists so that every page request does not fire its own
 * auth-service call and exhaust its rate limit.
 */
export interface AccessTokenProvider extends TokenProvider {
  /** Drops the cache: called on sign-out. */
  clear(): void;
}

export const ACCESS_TOKEN_TTL_MS = 60_000;

/**
 * `now` is injected for tests: cache behaviour stays deterministic without timers.
 */
export function createAccessToken(
  auth: AuthGateway,
  now: () => number = () => Date.now(),
): AccessTokenProvider {
  let cached: { token: string; expiresAt: number } | null = null;
  let inFlight: Promise<string | null> | null = null;
  // The generation counter guards against a race: a response started before clear()
  // must not put the old token back into the cache after sign-out.
  let generation = 0;

  return {
    async execute(): Promise<string | null> {
      const currentTime = now();

      if (cached !== null && cached.expiresAt > currentTime) {
        return cached.token;
      }

      // Parallel page requests must not stampede
      // /api/auth/token: everyone awaits the same in-flight request.
      if (inFlight !== null) {
        return inFlight;
      }

      const requestGeneration = generation;
      const request = (async () => {
        const token = await auth.accessToken();

        if (requestGeneration === generation) {
          if (token !== null) {
            // Cache on TTL: the token lives longer, but refreshing once a minute is
            // enough to stop hitting auth-service on every request.
            cached = { token, expiresAt: now() + ACCESS_TOKEN_TTL_MS };
          } else {
            cached = null;
          }
        }

        return token;
      })();

      inFlight = request;

      try {
        return await request;
      } finally {
        if (inFlight === request) {
          inFlight = null;
        }
      }
    },

    clear(): void {
      generation += 1;
      cached = null;
      inFlight = null;
    },
  };
}
