# notio

A Notion clone as a portfolio project: microservices on Cloudflare Workers, isolated databases,
a block editor and real-time collaborative editing on Durable Objects.

The goal is to demonstrate having skills for creating complex apps

> What works today: the gateway with proxying, rate limiting, CORS, end-to-end request IDs and
> JWT verification via JWKS; the auth-service (Better Auth on D1) with sign-up, email
> verification, cookie sessions and JWT issuance; the pages-service with a page tree on D1.
> On the frontend — sign-in and sign-up, with routes protected through `proxy.ts`.

## Stack

| Area           | Choice                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| Monorepo       | pnpm workspaces + Turborepo                                             |
| Frontend       | vinext (Next.js App Router on Vite), TanStack Query, Zustand, shadcn/ui |
| Editor         | Tiptap + Yjs, dnd-kit                                                   |
| Backend        | Hono on Cloudflare Workers, Service Bindings between services           |
| Data           | D1 (database-per-service), Drizzle ORM + drizzle-kit                    |
| Files & queues | R2, KV, Queues, Cron Triggers                                           |
| Realtime       | Durable Objects (Hibernation API) + Yjs                                 |
| Authentication | Better Auth (Drizzle adapter, D1)                                       |
| Tests          | Vitest 5, @cloudflare/vitest-plugin, Testing Library, Playwright        |
| Lint & format  | oxlint + oxfmt                                                          |
| CI/CD          | GitHub Actions + Wrangler                                               |

## Structure

```
notio/
├─ apps/web/                App Router on vinext (Vite)
├─ services/
│  ├─ gateway/              the single public entry point: routing, CORS, rate limiting
│  ├─ pages-service/        pages and blocks, its own D1 database notio-pages
│  ├─ auth-service/         Better Auth authentication, its own D1 database notio-auth
│  └─ ...                   workspace, media, search, realtime — added later
├─ packages/
│  ├─ contracts/            Zod API schemas, RFC 7807, error codes, events
│  ├─ db/                   shared Drizzle utilities for services
│  ├─ observability/        structured logging
│  └─ config/               tsconfig presets
├─ docs/adr/                architecture decisions
└─ scripts/                 smoke check of the end-to-end request path
```

## Quick start

```bash
pnpm install
cp .dev.vars.example .dev.vars   # local BETTER_AUTH_SECRET
pnpm db:migrate                  # migrate both databases: notio-pages and notio-auth
pnpm db:seed:pages               # demo data (optional)
pnpm dev                         # workers (wrangler) and web (vinext / vite dev)
```

Secrets are read from the `.dev.vars` next to each service's config, so the file is needed both
at the root and in `services/auth-service/` (the second one can be a symlink).

- frontend: http://localhost:3000
- API index: http://localhost:8787/
- gateway (liveness): http://localhost:8787/health
- gateway (readiness, probes the services): http://localhost:8787/api/health
- authentication: http://localhost:3000/register and http://localhost:3000/login
- pages through the gateway: http://localhost:8787/api/pages?workspaceId=… (JWT required)

The full end-to-end path (client → gateway → Service Binding → service → D1) is checked by a
single command — it starts the backend, applies migrations and shuts it down afterwards:

```bash
pnpm smoke              # starts and stops the backend itself
pnpm smoke -- --verbose # with workers logs
pnpm smoke -- --reuse   # use an already running backend, shut nothing down
```

Its own logs are needed for the email verification link, so by default smoke always starts its
own backend; if something is already answering on the port, the script stops and warns. `--reuse`
skips the startup, but then verification is assembled from `.dev.vars` — a local-stand-only mode.

## Authentication and API access

Sign-in and sign-up live on the frontend (`/login`, `/register`). The session is kept in the
httpOnly `notio.session_token` cookie, so the browser sends it automatically. Private `/api/*`
routes (except `/api/health` and `/api/auth/*`) require a JWT:

```bash
WS=00000000-0000-4000-8000-000000000001
EMAIL="you@notio.test"
PASS="correct-horse-battery"

# 1. Sign up: the verification email goes to the auth-service log (in dev).
#    Signing up again with the same address returns 409 CONFLICT.
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "content-type: application/json" -H "origin: http://localhost:8787" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"You\"}"

# 2. Verify: follow the link from the log, shaped like /api/auth/verify-email?token=…&callbackURL=%2F
curl "http://localhost:8787/api/auth/verify-email?token=<TOKEN>&callbackURL=%2F"

# 3. Sign in and obtain a JWT (the cookie is saved to a file).
curl -s -c cookies.txt -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "content-type: application/json" -H "origin: http://localhost:8787" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}"
JWT=$(curl -s -b cookies.txt http://localhost:8787/api/auth/token | sed 's/.*"token":"\([^"]*\)".*/\1/')

# 4. Call a private API on behalf of the user.
curl -H "authorization: Bearer $JWT" \
  "http://localhost:8787/api/pages?workspaceId=$WS"

curl -X POST http://localhost:8787/api/pages \
  -H "content-type: application/json" -H "authorization: Bearer $JWT" \
  -d "{\"workspaceId\":\"$WS\",\"title\":\"New page\"}"
```

Identity comes only from the signed token: a client-supplied `x-actor-id` header is discarded and
the gateway passes the user id from the claims to the service. Without a token you get `401` in
`application/problem+json` format.

### Sign in with Google and GitHub

A provider is enabled only when both halves of its key are set in
`services/auth-service/.dev.vars` (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`,
`GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`). The redirect URI is built from `BETTER_AUTH_URL`,
so the callback goes **through the gateway, not through the frontend**:

```
Google:  http://localhost:8787/api/auth/callback/google
GitHub:  http://localhost:8787/api/auth/callback/github
```

Both addresses must be registered in the provider console (Google Cloud → OAuth client →
Authorized redirect URIs; GitHub → OAuth App → Authorization callback URL — a single address
there). Common reasons why "the button does not work":

- **The address is registered on port 3000.** The callback is served by the auth-service behind
  the gateway, port 8787. A Google app that has not passed verification yet (publishing status
  `Testing`) only admits accounts from the Test users list — everyone else gets
  `Error 403: access_denied`.
- **The app is opened as `127.0.0.1:3000`.** The session cookie and `state` live on the gateway
  host (`localhost`), so the app must be opened under the same name: `http://localhost:3000`.
- **An account with a password already exists.** Email-based linking is enabled
  (`accountLinking.trustedProviders` = the configured providers), but the local email has to be
  verified — otherwise provider sign-in is rejected.

A provider error returns the user to the sign-in page with `?error=<code>`
(`access_denied`, `state_mismatch`, `invalid_code`, …), the form shows the reason, and the
auth-service logs it (`oauth_callback_error`).

## Pages API (through the gateway)

Pages are available only with a JWT — see "Authentication and API access" above.
`/`, `/health`, `/api/health` and `/api/auth/*` remain public.

## Scripts

| Command                                                 | What it does                                     |
| ------------------------------------------------------- | ------------------------------------------------ |
| `pnpm dev`                                              | Starts workers and web together                  |
| `pnpm dev:workers`                                      | Backend only: `wrangler dev` with three services |
| `pnpm dev:gateway` / `pnpm dev:auth` / `pnpm dev:pages` | A single service on its own                      |
| `pnpm build`                                            | Builds the workers (dry-run bundle) and frontend |
| `pnpm typecheck`                                        | `tsc` in every package + Workers type generation |
| `pnpm lint`                                             | oxlint across the whole monorepo                 |
| `pnpm format` / `pnpm format:check`                     | oxfmt                                            |
| `pnpm test` / `pnpm test:coverage`                      | Tests, 80% coverage threshold                    |
| `pnpm smoke`                                            | Smoke check: auth, JWT, D1 writes, headers       |
| `pnpm types`                                            | Generates `worker-configuration.d.ts`            |
| `pnpm db:generate`                                      | New migration from the Drizzle schema            |
| `pnpm db:migrate` / `pnpm db:seed:pages`                | Migrations for both databases and demo data      |

## Architecture decisions

Documents in `docs/adr/`:

1. [Monorepo on pnpm workspaces + Turborepo](docs/adr/0001-monorepo-pnpm-turborepo.md)
2. [Inter-service communication through Service Bindings](docs/adr/0002-service-bindings-between-services.md)
3. [End-to-end types: Hono RPC + Zod](docs/adr/0003-end-to-end-types-hono-rpc-zod.md)
4. [Worker tests: Vitest 5 + @cloudflare/vitest-plugin](docs/adr/0004-testing-with-vitest-cloudflare-plugin.md)
5. [Linter and formatter: oxlint + oxfmt](docs/adr/0005-oxlint-oxfmt-tooling.md)
6. [Data layer: Drizzle, fractional indexing, UUIDv4](docs/adr/0006-data-layer-drizzle-fractional-indexing.md)
7. [Gateway cross-cutting infrastructure](docs/adr/0007-gateway-cross-cutting-middleware.md)
8. [Authentication: Better Auth, cookie session and JWT for the gateway](docs/adr/0008-auth-service-better-auth-jwt.md)
9. [Frontend authentication: layers, DI and JWT-based API access](docs/adr/0009-frontend-auth-layers.md)
