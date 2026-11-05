# ADR 0026. Library: a table of all pages instead of a tree on the home page

- **Status:** accepted
- **Date:** 2026-10-28

## Context

The workspace home page (`/workspaces/:id`) showed the same page tree as the sidebar: duplicated
navigation with no way to see the workspace as a whole — who the author is, where a page lives, when
it was edited. The task is a Notion-Library-style table: title, author, source, modification time and
last-opened time, plus filter tabs, search and column settings.

The API had no data for this: `GET /pages` returns one level of the tree (by `parentId`), and flat
lists existed only for favourites, trash and search.

## Decision

- **A new flat list `GET /pages/all?workspaceId=…`.** Returns all non-deleted workspace pages in tree
  order, with `parentId` and `hasChildren` (the flag is computed with the same query as the tree). The
  alternative — walking the tree level by level — would cost a request per expanded branch and would
  not allow filtering across the whole space.
- **Nesting is assembled on the client.** `usePages(…, 'all')` puts the list in the `pageKeys.flat`
  cache, the component builds a "parent → children" map and expands the rows; a row with children gets
  a chevron, and indentation is computed by depth. A page whose parent is missing is shown as a root.
- **The tabs are real data slices.** "Recent" is everything, "Favourites" is `isFavorite`, "Shared"
  is other members' pages, "Private" is mine. Notion tabs that have no model (AI Meeting Notes,
  Skills) were not created: an empty tab is worse than a missing one.
- **Filter, search and tabs switch the table to flat mode** — rows are sorted by modification time.
  Indentation under a hidden parent would read as random offset; "Recent" without filters keeps tree
  order.
- **Columns are toggled from the Display menu** (`core/ui/library`); the column set is local state:
  it is the user's view, not data.
- **"Last opened" is computed locally.** The read server does not write: `LastPageTracker`, together
  with the last page, stores a timestamp in localStorage (`storePageVisit`, the map is capped at 300
  entries), and the table reads it after mounting — otherwise SSR and the client would produce
  different cells.
- **The component lives in `core`**, not in the `pages` module: it assembles the pages module (rows),
  workspaces (author names) and auth (who "I" am).
- **Time uses `Intl.RelativeTimeFormat` with the `short` style.** The `shortAgo` utility returns a
  "unit + value" pair (including weeks, months, years), and the locale  formats it. `narrow` in Russian drops the trailing "ago" and prints a bare "-3", so `short` was
  chosen.

## Alternatives

- **Keeping the tree and adding columns to it.** The tree answers "where is the page", the library
  answers "what do I have"; the tree has room neither for sorting by time nor for searching the whole
  space.
- **Filtering on the server.** Would require parameters for every slice and a separate endpoint per
  tab; at personal-workspace volumes the list arrives in one request and filters instantly.
- **Storing visits on the server.** More honest across devices, but requires a table and a write on
  every page open; for a "when did I see this" column a local timestamp is enough and puts no load on
  the API.

## Consequences

- The home page shows the whole space at once: sorting by time, search, filters and column toggling
  work without the network.
- The list is not paginated (like favourites and trash): very large spaces would need a cursor — the
  `listAll` signature allows for it.
- "Last opened" is empty until the first visit and is not synced between browsers — an expected
  consequence of local storage.
- Names in the "Author" column come from the member list; if it is unavailable, a dash is shown (your
  own pages are labelled with the session name).
