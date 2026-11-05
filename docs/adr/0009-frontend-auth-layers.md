# ADR 0009. Frontend authentication: layers, DI and JWT-based API access

- **Status:** accepted (the directory structure was replaced by ADR 0010; the decisions about the
  session, errors and proxy still stand)
- **Date:** 2026-10-18

## Context

`.agents/AGENTS.md` defines the frontend layering: domain → application → adapters → ui, dependency
assembly in `core/container.ts`, server state in TanStack Query, tokens never stored in the
browser. For authentication this means form components must know neither Better Auth nor its error
codes, and pages must not decide on their own what to show on a 401.

Additionally: in Next.js 16 `middleware.ts` was renamed to `proxy.ts` (the convention is
deprecated), so route protection is described anew.

## Decision

### The `features/auth` feature

| Layer | Contents | Example |
|---|---|---|
| domain | rules and errors, pure TS | `credentials.ts`, `errors.ts` |
| application | ports and use cases | `ports.ts`, `sign-in.ts`, `sign-up.ts`, `sign-out.ts`, `current-session.ts`, `access-token.ts` |
| adapters | Better Auth + Zod + error translation | `auth.gateway.api.ts`, `auth.dto.ts`, `auth.error-mapper.ts` |
| ui | Query hooks and forms | `use-auth.ts`, `login-form.tsx`, `register-form.tsx`, `session-panel.tsx` |

The feature's public API is `features/auth/index.ts`: use cases and forms are exported, while ports
and adapters stay internal. Components get ready-made use cases through `useContainer()`; there are
no direct adapter imports in components.

### Session in TanStack Query, not Zustand

Session data comes from the server and changes on "signed out/signed in" events, so it lives in
`useSession()` with the `authKeys.session()` key factory. Zustand holds only UI state (open panels,
selection). The token never enters any store: it is taken from the use case immediately before a
request.

### Errors by code, not by text

`auth.error-mapper.ts` maps Better Auth codes (`INVALID_EMAIL_OR_PASSWORD`, `EMAIL_NOT_VERIFIED`,
`PASSWORD_TOO_SHORT`, …) to domain codes (`INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, …) with
translated messages. An unknown code becomes `UNKNOWN` with a clear message rather than being
swallowed: a silently swallowed sign-in error looks like "nothing happened".

### Route protection — `src/proxy.ts`

The proxy only checks for the presence of the `notio.session_token` cookie and redirects to
`/login?next=…`. This is UX, not protection: the actual signature and permission check happens at
the gateway. Hiding the page is not enough — the server still will not return data.

## Alternatives

- **Storing the JWT in Zustand/localStorage.** Rejected: the token is reachable by page scripts.
- **Storing the session in Zustand.** Rejected: server state in a UI store becomes desynchronised.
- **Verifying the JWT in the proxy.** Rejected: the proxy must decide quickly and without network
  access; signature verification lives in the gateway, where JWKS is available.
- **Passing Better Auth error codes straight to the UI.** Rejected: couples components to the
  service.

## Consequences

- `apps/web` is checked with plain `tsc --noEmit`: the `next` package is no longer installed, and
  `next/*` declarations and route types are provided by vinext (see ADR 0027).
- The UI is covered by component tests (Testing Library + jsdom): the sign-in, sign-up and session
  panel are tested through user behaviour, with the network and container stubbed. Coverage is
  measured across all four layers, including `ui`.
