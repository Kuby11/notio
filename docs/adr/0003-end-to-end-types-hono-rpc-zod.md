# ADR 0003. API types: Hono RPC + Zod contracts

- **Status:** accepted
- **Date:** 2026-10-18

## Context

We need end-to-end typed interaction between frontend and backend without duplicating schemas
and without `any` at the network boundary.

## Decision

Two independent mechanisms covering different concerns:

1. **Hono RPC — transport types.** The gateway exports the type of its app:

   ```ts
   // services/gateway/src/app.ts
   export type GatewayAppType = ReturnType<typeof createGatewayApp>;
   ```

   The frontend builds an `hc<GatewayAppType>('/api')` client and gets path, parameter and
   response types straight from the gateway's own code.

2. **Zod in `packages/contracts` — the data contract.** Every server response and every client
   input is described by a Zod schema. What is exposed is the Zod schemas from the shared package,
   not "loose" types. Validation happens at the boundary: the frontend adapter does not trust the
   network, and the gateway validates input.

### Binding types

Binding types come from the config, not from a library: `wrangler types` generates
`worker-configuration.d.ts`, where the gateway gets `PAGES_SERVICE: Fetcher`. The local `Bindings`
interface in `src/env.ts` describes what the service expects — if it drifts from the config,
compilation fails.

**A deliberate trade-off:** Hono 4.13 does not export a `Fetcher<AppType>` type, so calling an
internal service is not typed by route and returns a plain `Response`. The response shape is
guaranteed by a Zod schema: the gateway does not trust its neighbour and validates its response
(`HealthResponseSchema.safeParse`). The alternative is Workers RPC (`Service<RpcEntrypoint>`) with
typed methods; it is worth evaluating at Stage 1, when real data operations appear rather than
just health checks.

## Errors

A single RFC 7807 format (`application/problem+json`), built by the `problem()` helper from
`@notio/contracts`. The frontend turns it into typed domain errors (`NotFoundError`,
`ForbiddenError`, ...) and distinguishes them by type, not by message text.

## Consequences

**Positive:**

- renaming a route or a field breaks the build, not production;
- the contract is the same for the frontend, the service and the tests.

**Negative:**

- types are lost across the JSON boundary (Zod is needed to restore them);
- `Fetcher<AppType>` requires the service's app type to be importable — this couples the
  service's TypeScript project to the gateway at the type level (a deliberate trade-off).

## Alternatives

- **OpenAPI + a generated client** — gives a REST contract and compatibility with external
  clients, but loses the "route ↔ response type" link and adds a code generation step.
- **Fully Zod-first (types inferred from schemas by hand)** — does not provide the typing of
  paths and route parameters that Hono RPC gives.
