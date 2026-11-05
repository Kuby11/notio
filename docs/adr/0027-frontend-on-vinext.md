# ADR 0027. Frontend on vinext instead of the Next.js toolchain

- **Status:** accepted
- **Date:** 2026-11-04

## Context

`apps/web` is written in Next.js 16 (App Router) and was built with the standard `next build`. The
backend lives entirely on Cloudflare Workers, so the frontend needs a deployment path to Workers
without a separate build adapter. The `next` package brings its own compiler and does not build the
app for Workers directly.

`vinext` is a Vite plugin that implements Next.js's public API (routing, RSC, `next/*`, `proxy.ts`,
the Metadata API) on top of Vite and integrates natively with Workers through
`@cloudflare/vite-plugin`. Compatibility was checked with `vinext check`: 21 supported capabilities,
4 partial, 0 incompatible.

## Decision

1. Build and dev server are Vite with the `vinext()` and `@cloudflare/vite-plugin` plugins;
   deployment is `vinext-cloudflare deploy` driven by `cloudflare.config.ts`.
2. The `next` package was removed from dependencies. Declarations for `next` and `next/*` for `tsc`
   and the runtime are provided by vinext (`apps/web/vinext-env.d.ts`), so sources keep importing
   `next/navigation`, `next/link`, `next/headers` and so on.
3. `next.config.ts` stays: vinext reads `headers()` (CSP and security headers), `transpilePackages`
   and `poweredByHeader` from it. The `turbopack`/`webpack` settings were removed — vinext resolves
   the `next-intl/config` alias itself.
4. Vitest resolves `next/*` to vinext's runtime shims: the real package is not needed in tests.
5. `pnpm typecheck` in `apps/web` is `tsc --noEmit`; `vinext typegen` is not run because it overwrites
   `next-env.d.ts` with a Next template.

## Consequences

- `pnpm dev` / `pnpm build` / `pnpm start` in `apps/web` run through Vite; `pnpm deploy` builds and
  publishes the Worker.
- The dev server prints Vite warnings about dependency optimisation (`next-intl` and
  `@tanstack/react-query`); they affect neither the build nor the runtime.
- Next's proprietary features are unavailable (typed routes, Turbopack loaders): typed `href`s are
  not generated, and loader configs have to be ported to Vite plugins.
- The rest of the monorepo is untouched: the frontend still talks to the backend only through the
  gateway.
