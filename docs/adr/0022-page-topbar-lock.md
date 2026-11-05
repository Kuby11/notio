# ADR 0022. Page top bar: sticky panel, locking, modification time

- **Status:** accepted
- **Date:** 2026-10-25

## Context

All page metadata (breadcrumbs, "edited N ago", favourites, the "three dots" menu) lived in the
document flow and scrolled away. Three problems surfaced along the way: a hydration render error of
`li` inside `li` (the breadcrumb separator was nested in the breadcrumb item), breadcrumbs linked to
the workspace — whose path is already visible in the sidebar — and the timestamp showed
`page.updatedAt`, which did not change when content was edited (`blocks` rows are updated, not
pages). "Copy content" and "Lock page" were also needed in the header menu.

## Decision

- **The top bar is a sticky panel and a direct child of the scrollable `main`.** Sticky is bounded by
  its parent: inside the `max-w-52rem` column wrapper the panel would not stick. Negative margins
  `-mx-6 -mt-6` cancel main's `p-6` — the panel spans the full width and hugs the top while
  scrolling. The large title stays in the document flow, as in Notion. The autosave indicator moved
  to `top-10` so it is not hidden under the panel.
- **Breadcrumbs: the separator is a sibling `BreadcrumbItem`, not a child.** The nova base renders
  both the item and the separator as `li`; nesting produces a hydration error and breaks list
  semantics. The workspace was removed from the chain.
- **Page locking is a server-side `pages.is_locked` flag** (a D1 column + `isLocked` in the contract,
  optional for older client compatibility). The blocks service requires the page to be writable:
  `assertPageWritable` (exists + not trashed + not locked) was introduced for mutations, while
  reading blocks remains allowed. Client: the header menu toggles the flag (the generic `updatePage`
  mutation), the editor facade reads the same `pageKeys.detail` key as the header and calls
  `editor.setEditable(!isLocked)`. Invalidating `pageKeys.all` updates both labels at once. Table
  pills, the bubble menu, the slash menu, image resize and DragHandle hide based on `isEditable`; the
  header title is `disabled`.
- **Content modification time:** after every block mutation the blocks service updates
  `pages.updatedAt` (the repository gained `touch`), and the client's autosave patches the
  `pageKeys.detail` cache directly — invalidating all page queries on every typing pause is too
  expensive. The detail query is polled every 30 seconds as a safety net.

## Alternatives

- **Copying content from server blocks.** More accurate (structure up to the last save), but the
  header would depend on the editor module's cache. Text from the rendered DOM (`innerText` of blocks
  joined by `\n\n`) honestly copies what the user sees and creates no coupling between modules.
- **Client-only locking (store/localStorage).** Would be lost across devices and would not protect
  the API; a server-side check in the blocks service is mandatory, otherwise the lock is decorative.
- **A separate `contentUpdatedAt` field.** Semantically more honest, but requires a new contract
  field, a migration and a second time source in the header; "the document changed" already includes
  page metadata.

## Consequences

- A locked page can be read but not edited, either through the UI or the API (409 on block
  mutations); creating child pages and metadata (favourites, trash) remain available.
- `page.updatedAt` now changes on content edits: "recently modified" lists (if they appear) will get
  the correct order.
- A duplicate of a locked page is created unlocked (`isLocked` is not copied — the column takes its
  default).
