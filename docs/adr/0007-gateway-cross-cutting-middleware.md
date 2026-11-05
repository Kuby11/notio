# ADR 0007. Gateway cross-cutting infrastructure: request-id, CORS, rate limit, logs

- **Status:** accepted
- **Date:** 2026-10-18

## Context

The gateway is the only public entry point. Whatever it does, it must apply cross-cutting rules
identically to every route: identify the request for logs, reject foreign origins, limit request
rate and not leak extra headers. JWT verification was added here later (Stage 2).

## Decision

Middleware order in `services/gateway/src/app.ts`:

1. **request-id** — accepts a valid incoming `x-request-id` or generates a UUID.
2. **config** — parses the current request's vars (Zod); on error it fails instead of silently
   weakening protection.
3. **security-headers** — CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS only over
   https.
4. **CORS** — allowlist from `CORS_ALLOWED_ORIGINS`, `Vary: Origin`, preflight 204/403.
5. **rate limit** — `/api/*` only, counter in KV, fixed window.
6. **logging** — one JSON line per request: method, path, status, duration.
7. **proxying** — service routes.

### Key details

- **The gateway overwrites internal headers rather than forwarding them.** Client-supplied
  `x-user-id`, `x-request-id` and `x-notio-source` are discarded; the service receives what the
  gateway itself decided. Otherwise anyone who reached the gateway could claim to be another user.
- **request-id is validated against** `[A-Za-z0-9_-]{1,64}`: otherwise junk could be injected
  into logs through the header.
- **Rate limiting by IP from `cf-connecting-ip`**, not from client headers; the limit does not
  apply to `/health`, otherwise monitoring would block itself.
- **Headers are set after `next()` directly on `c.res.headers`**: some routes return a ready-made
  `Response` (the proxy), and headers set via `c.header()` before `next()` do not reach such
  responses — the API would be served unprotected.
- **The service response passes a header allowlist**: only `content-type`, `cache-control` and
  `retry-after` go outwards. `set-cookie` and the service's internal headers are not forwarded.
- **Identity is fail closed**: outside `development` the gateway does not accept `x-user-id` from
  the client (a signature appears with auth-service in Stage 2), and a write without a user
  context is rejected with 403.

## Consequences

**Positive:**

- an end-to-end request-id links gateway and service logs;
- negative scenarios (foreign origin, header spoofing, limit, broken service) are covered by
  automated tests;
- configuration is validated by Zod: a typo in the limit fails startup instead of opening the API.

**Negative:**

- KV in Workers is eventually consistent: concurrent requests from one client can slip past the
  counter by one. That is enough for API protection; strict limits would need a Durable Object;
- if KV is unavailable the limiter fails open: cache unavailability must not take the API down.

## Alternatives

- **Rate limit in a Durable Object** — atomic sliding window, but a separate class, migrations and
  a cost per request.
- **Cloudflare WAF / Rate Limiting Rules** — removes code from the project, but rules live in the
  dashboard rather than the repository and are not covered by tests.
- **Reflecting Origin in CORS** — unacceptable: together with cookies it gives any site that
  sends its own origin cross-domain access to the session.
