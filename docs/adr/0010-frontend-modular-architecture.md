# ADR 0010. Frontend modular architecture: shared, core, modules

- **Status:** accepted
- **Date:** 2026-10-20

## Context

The frontend grew out of vertical `features/<feature>` features with domain → application →
adapters → ui layers (ADR 0009). The layers were spread across folders, but:

- a feature's public API mixed UI, use cases and adapters — boundaries were upheld only by review;
- there was no rule about state: a Zustand store could import any code;
- `shared/components` held shell components that depended on features, i.e. "shared" knew about the
  domain;
- API repositories imported `AccessToken` from the auth feature directly — modules depended on each
  other rather than on an interface.

What is needed is a structure where reusable code knows nothing about the domain, a module has a
fixed anatomy with a public `index.ts`, the API layer does not pull in state or UI, stores are
private, each module has a facade hook, and business logic lives in hooks.

## Decision

### Directories

```
src/
├─ app/         # thin App Router routes
├─ core/        # composition root: container, providers, shell (AppLayout/AppSidebar)
├─ shared/      # hooks, ui (primitives), configs, types — with no knowledge of the domain
└─ modules/<module>/
   ├─ hooks/            # the module's facade hook and operation hooks (one hook per file)
   ├─ stores/           # Zustand: module UI state only (if needed)
   ├─ api/              # calls + Zod, token cache, no state and no UI
   ├─ types/            # types, ports, DTO schemas
   ├─ utils/            # pure functions, rules, mappers, Query keys
   ├─ ui/private|public # components: internal and exported
   └─ index.ts          # the module's public API
```

Folders a module does not need are not created: there are no empty `stores` or `ui` folders with
`.gitkeep` in the repository.

### Boundary rules

- `shared` does not import `modules`/`core`/`app`.
- The only way into a module is `modules/<module>` (index.ts): the factory, the facade hook and
  public hooks, public components, public types.
- `api` and `stores` are used only inside their own module.
- `api` is networking and Zod only: no React, TanStack Query, Zustand or `core`.
- A store holds raw UI state; it is exposed through the facade hook.
- Each module has a facade hook (`useAuth`, `usePages`, `useWorkspaces`, `useEditor`): it gives
  components their queries, mutations, store and rules. A large facade can be split into operation
  hooks, but one file holds one hook, and the file name matches the hook name
  (`use-database-views.ts` → `useDatabaseViews`).
- TanStack Query keys live only in the module's `utils/query-keys.ts`.
- `ui` contains components only: `hooks` and `stores` folders inside `ui` are forbidden.
- Dependency inversion: hooks depend on a port (`types/ports.ts`), the adapter implements the port
  in `api`, and the composition root wires them. There is no separate layer of use-case classes:
  business logic lives in hooks, domain rules in `utils`.
- `shared/types.TokenProvider` breaks the dependency of pages/editor/workspaces on the auth module.

### Automated check

`scripts/check-boundaries.mjs` runs as part of `pnpm lint` and forbids shared imports from modules,
deep module imports, `stores`/`api` escaping their module, React/Query/Zustand inside `api`,
`hooks/use-cases` folders, `hooks`/`stores` inside `ui`, a missing facade hook, several hooks in one
file and `query-keys.ts` outside `utils`.

### Composition root

`core/container.tsx` calls the `createAuthModule`, `createPagesModule`, `createWorkspacesModule` and
`createEditorModule` factories and knows nothing about adapters and DTOs. A module assembles its own
API adapter and exposes only a port; the token arrives as a `TokenProvider` from `shared/types`.

## Alternatives

- **eslint-plugin-boundaries or dependency-cruiser.** Rejected: the project lints with oxlint, and a
  separate ESLint stack for boundaries is unnecessary; a dependency-free Node script solves the same
  task and is portable across OSes.
- **Keeping `features` and merely renaming folders.** Does not solve the privacy of stores/api and
  does not give facade hooks a single entry point.
- **Exporting stores from `index.ts` so "any module could read the state".** Rejected: state stops
  being encapsulated and hidden coupling appears.
- **Passing use cases through each module's own providers.** Rejected: DI leaks into the UI and is
  duplicated in every module.
- **Use-case classes with a single `execute` method per operation.** Rejected: they duplicated hook
  orchestration and added a stateless pass-through layer; domain rules moved to `utils`, and DI
  stayed in `useContainer()`.
- **A set of small hooks per operation.** Rejected: components assembled orchestration from several
  hooks, while cache invalidation and rules sprawled. Now a module exposes one facade hook with data
  and operations.

## Consequences

- ADR 0009 is partially superseded: the auth feature's layers moved (domain → `utils`, application
  → `hooks`, adapters → `api` + `types` + `utils`, ui → `ui/public`). The decisions about the
  session in TanStack Query, error codes and `proxy.ts` remain in force.
- Coverage is measured for the modules' pure logic (`utils`), with an 80% threshold; hooks and UI
  are checked by component tests and smoke.
- The anatomy does not require empty directories: a folder appears with its first file, and a
  module factory returns a port rather than a set of use-case objects.
- Components work with one facade hook per module; Query keys sit in `utils/query-keys.ts` next to
  the rest of the pure logic.
- A new domain is added as a module with a fixed anatomy; shared primitives and types go only in
  `shared`.
- The app shell (`AppLayout`, `AppSidebar`) moved to `core/ui`, because it assembles modules
  together; the dependency rule forbids keeping it in `shared`.
