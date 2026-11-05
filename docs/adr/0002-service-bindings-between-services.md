# ADR 0002. Inter-service communication through Service Bindings

- **Status:** accepted
- **Date:** 2026-10-18

## Context

The project consists of seven microservices (gateway, auth, workspace, pages, media, search,
realtime). Requirements: no service other than the gateway may be reachable from the internet,
and inter-service calls must not require public URLs, OAuth or network latency.

## Decision

The gateway is the single public entry point. All services are wired to it and to each other
through **Service Bindings** (`wrangler.jsonc` → `services[]`).

```jsonc
// services/gateway/wrangler.jsonc
"services": [{ "binding": "PAGES_SERVICE", "service": "pages-service" }]
```

- Internal services set `"workers_dev": false` — they are not published to the internet.
- There is no inter-service HTTP in the code at all: a call is `env.PAGES_SERVICE.fetch('/health')`.
- The gateway passes user context to services in headers; services do not blindly trust that
  data — permissions are checked in the service that owns the data (deny-by-default).

## Local development

A single Wrangler process starts several workers: the first config is the main one (reachable
over HTTP), the rest are auxiliary and reachable only through a Service Binding.

```bash
wrangler dev -c ./services/gateway/wrangler.jsonc -c ./services/pages-service/wrangler.jsonc
```

## Consequences

**Positive:**

- no public internal endpoints and no second place for authentication;
- no HTTP overhead or network hops between services;
- the same call mechanism locally and in production.

**Negative:**

- coupling: adding a service requires edits to the `wrangler.jsonc` of every caller;
- a service cannot be called with plain `curl` — use `pnpm dev:<service>` or the smoke script;
- in gateway tests the service stub is replaced by an in-memory binding implementation.

## Alternatives

- **Internal HTTP endpoints with mTLS** — realistic, but requires public DNS names, certificate
  management and duplicates authentication.
- **One worker for all services with an internal router** — simpler locally, but loses the point
  of microservices: no isolation of databases, deployments or resources.
