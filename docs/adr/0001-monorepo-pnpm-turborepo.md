# ADR 0001. Monorepo on pnpm workspaces + Turborepo

- **Status:** accepted
- **Date:** 2026-10-18

## Context

The project is split into independent parts: a Next.js frontend, Hono/Workers microservices and
shared packages (contracts, configuration). The parts must deploy independently while still using
shared Zod contracts and shared code-style rules.

## Decision

A monorepo with pnpm workspaces and Turborepo as the task orchestrator.

```
apps/web                 frontend
services/*               Workers microservices (one worker per service)
packages/contracts       Zod API schemas, RFC 7807, event types
packages/config          tsconfig presets and Vitest presets
```

- **JIT packages (just-in-time packages):** `packages/contracts` ships TypeScript sources
  (`exports: { ".": "./src/index.ts" }`), with no build step. Next gets `transpilePackages`,
  while Wrangler and Vitest compile TS themselves.
- **Turborepo** caches `build`, `typecheck` and `test` by hashing inputs and dependencies.
- **Database isolation** (database-per-service) comes from each service being a separate worker
  with its own `wrangler.jsonc` and its own D1 database. There are no shared tables; exchange
  happens through the API.

## Consequences

**Positive:**

- one `pnpm install`, one `pnpm dev`, one CI pipeline for the whole project;
- contracts change in one place, and both services and the frontend see the same thing;
- Turborepo provides incremental builds and CI caching.

**Negative:**

- boundaries need explicit control: internal packages must not "leak" outwards (enforced by the
  dependency rule from `.agents/AGENTS.md`);
- `pnpm-lock.yaml` is a single file — conflicts when working on dependencies in parallel.

## Alternatives

- **npm workspaces + Nx** — Nx is more powerful around the task graph, but heavier; Turborepo is
  simpler and faster for a monorepo of this size.
- **Separate repositories + versioned npm packages** — isolates teams, but breaks "everything in
  one PR" and makes end-to-end contract refactoring harder.
