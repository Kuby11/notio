# ADR 0004. Worker tests: Vitest 5 + @cloudflare/vitest-plugin

- **Status:** accepted
- **Date:** 2026-10-18

## Context

Integration tests for workers must run in the real Workers runtime with real bindings (D1, KV,
Service Bindings), not in a Node emulation.

## Decision

- **Vitest 5** (`vitest@5.0.5`) — a single version for the whole monorepo.
- **`@cloudflare/vitest-plugin`** — the official plugin for running tests inside `workerd`.
  It replaces `@cloudflare/vitest-pool-workers`: the old package is marked as renamed and is no
  longer updated.
- Service config: `cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })` — bindings
  come from the same config as in local development.
- `packages/contracts` is tested with plain Vitest in Node: these are pure schemas without
  runtime dependencies.

### Test environment for bindings

- **pages-service** — the real configuration, a real local D1.
- **gateway** — the gateway config is deliberately not loaded: its Service Binding points at a
  separate worker that does not exist in the test process. Service behaviour is replaced by an
  in-memory binding implementation, which gives deterministic "ok", "5xx", "broken contract" and
  "service unavailable" scenarios.
- The **real** Service Binding (gateway → pages-service inside one `workerd`) is checked by the
  `pnpm smoke` script against a running `pnpm dev:workers`.

### Coverage

A threshold of ≥ 80% (lines/branches/functions/statements) is set in every package's config and
in CI (`pnpm test:coverage`). For the frontend's domain/application layers the threshold will be
raised to 90%.

## Consequences

**Positive:**

- tests catch runtime-specific problems (Response, encodings, Workers limits);
- the binding config is not duplicated: tests and local development read the same `wrangler.jsonc`;
- a test run takes tens of milliseconds instead of seconds.

**Negative:**

- Node 22 and a `workerd` build compatible with Linux/macOS/Windows are required;
- the gateway configuration in tests differs from production — the smoke script closes that gap.

## Alternatives

- **Node + `unstable_dev` / `wrangler dev` as an external process** — closer to reality, but slow,
  without isolation and inconvenient for unit tests.
- **MSW for binding mocks** — does not cover Workers-specific APIs (ExecutionContext, Durable
  Objects, Hibernation API) and does not check binding types.
