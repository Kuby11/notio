# ADR 0028. Same-origin auth proxy for deployments on workers.dev

- **Status:** accepted
- **Date:** 2026-11-09

## Context

In production the web app and the gateway are separate Workers:
`notio-web.<account>.workers.dev` and `notio-gateway.<account>.workers.dev`. Better Auth keeps the
session in an httpOnly cookie. The `workers.dev` suffix is on the Public Suffix List, so a browser
rejects any cookie with `Domain=<account>.workers.dev` (and even a host-only cookie on the gateway is
a third-party cookie for the web app). The OAuth callback completed on the gateway, the session
cookie was dropped, and `proxy.ts` on the web app sent the user back to `/login` — the console showed
`UNAUTHORIZED` from the session request. The `COOKIE_DOMAIN` / `crossSubDomainCookies` setup cannot
work on this domain.

## Decision

1. The Better Auth client is created with an empty `baseURL`, so all auth calls are made to the app
   origin.
2. `apps/web/src/app/api/auth/[...auth]/route.ts` forwards `/api/auth/*` to the gateway server-side
   and returns the upstream response as is, including `Set-Cookie`. The session cookie is therefore
   issued for the web host, which is the only origin that can hold it.
3. The route reaches the gateway through a **Service binding** (`GATEWAY` in
   `apps/web/cloudflare.config.ts`, bound to the `notio-gateway` Worker). A public subrequest between
   two Workers inside one zone is refused by Cloudflare with error 1042: the proxy answered 404 in
   production while the same bundle worked under `wrangler dev`. Locally the binding is unused and the
   route falls back to a plain `fetch` of `NEXT_PUBLIC_GATEWAY_URL` (localhost).
4. `BETTER_AUTH_URL` is the web origin: the OAuth `redirect_uri` points at
   `<web>/api/auth/callback/<provider>`, which the same route proxies, so the OAuth state cookie is
   also read on the app origin.
5. The rest of the API (pages, workspaces, media, databases) keeps calling the gateway directly with
   a short-lived Bearer JWT; those requests need no cookie.
6. `COOKIE_DOMAIN` stays available for a deployment on a real registrable domain
   (`app.example.com` + `api.example.com`), where a shared parent cookie is valid. It must never be
   set to a public suffix.

## Alternatives

- **`crossSubDomainCookies` with `COOKIE_DOMAIN=<account>.workers.dev`.** Rejected: such a cookie is
  discarded by every major browser because the domain is a public suffix.
- **Host-only cookie on the gateway with `SameSite=None`.** Rejected: it is a third-party cookie for
  the web app and is blocked or partitioned by default in modern browsers.
- **A custom domain.** Not rejected as a future option, but it is an infrastructure change and does
  not fix deployments that stay on `*.workers.dev`.
- **`fetch('https://notio-gateway.<account>.workers.dev/...')` from the web Worker.** Rejected: the
  Cloudflare edge refuses same-zone Worker-to-Worker subrequests by public hostname (error 1042). The
  response is an HTML 404, which is easy to mistake for a routing bug; only a Service binding (or a
  custom domain in another zone) crosses that boundary.

## Consequences

- Auth works on `*.workers.dev` without a custom domain: the session cookie belongs to the app host.
- The web Worker must keep the `GATEWAY` Service binding to the gateway Worker; without it the proxy
  fails with Cloudflare error 1042 (a public same-zone Worker-to-Worker subrequest).
- Every auth call costs one extra hop (web Worker → gateway) and the gateway keeps accepting
  `/api/auth/*` directly, which is useful for local development.
- The route handler is the single place responsible for forwarding `Set-Cookie`; a future vinext
  change to App Router route handlers must keep proxy responses untouched.
