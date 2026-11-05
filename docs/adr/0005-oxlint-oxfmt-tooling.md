# ADR 0005. Linter and formatter: oxlint + oxfmt instead of ESLint + Prettier

- **Status:** accepted
- **Date:** 2026-10-18

## Context

The classic ESLint + Prettier pairing needs JavaScript config support, dozens of dependencies and
type-aware rules that duplicate `tsc`. The project needs a fast linter and formatter with a single
source of truth.

## Decision

- **`oxlint@1.88.0`** — the linter. One `.oxlintrc.json` for the whole monorepo, built-in
  `typescript`, `oxc`, `import`, `unicorn` and `promise` plugins, the `correctness` and
  `suspicious` categories, `denyWarnings: true`, and unused `oxlint-disable` directives forbidden.
- **`oxfmt@0.73.0`** — the formatter. Config `.oxfmtrc.json`, compatible with Prettier settings.
- Lint and format run from the root (`pnpm lint`, `pnpm format`), not from each package: oxlint
  analyses the project as a whole and builds one module graph.
- Type checking stays with `tsc` (`pnpm typecheck`).

Rules that directly express the project's principles:

| Rule | Principle |
|---|---|
| `typescript/no-explicit-any` | no `any` |
| `typescript/ban-ts-comment` | `@ts-expect-error` only with a stated reason |
| `typescript/consistent-type-imports` | explicit type imports, not "mixed" ones |
| `typescript/no-unused-vars`, `import/no-duplicates` | clean code |
| `eqeqeq`, `no-implicit-coercion` | no implicit comparisons or coercions |

## Consequences

**Positive:**

- linting the whole monorepo is orders of magnitude faster than ESLint, and the config is one JSON
  file;
- no "race" between linter and formatter: oxfmt does not conflict with oxlint rules;
- type-aware rules are available later (`oxlint-tsgolint`), without migrating to another linter.

**Negative:**

- some rare ESLint rules are not supported yet — where necessary, TypeScript checking stays in
  `tsc`;
- `oxfmt` is younger than Prettier: rare edge-case formatting may differ.

## Alternatives

- **ESLint 10 + typescript-eslint + Prettier** — proven and familiar, but slow, requires
  `eslint.config.mjs` with JS configs and duplicates types.
- **Biome** — a single "linter + formatter" tool, but fewer rules and no type-aware linting.
