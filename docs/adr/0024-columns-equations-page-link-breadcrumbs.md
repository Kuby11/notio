# ADR 0024. Columns, equations, page links and breadcrumbs

- **Status:** accepted
- **Date:** 2026-10-25

## Context

Five new blocks modelled on Notion: columns (2–5), block and inline equations (LaTeX), a link to an
existing page, and document breadcrumbs. Until then the block model knew one container (toggle), and
storing "children inside the block row" had already been tried on it.

## Decision

- **Columns are the second container: `columns` (2–5 columns, `children` in each).** Column children
  do not own database rows: `ownsBlockRow` looks at `parent === 'doc'`, so nested paragraphs get no id
  and are saved inside the columns row (the same semantics as toggle). Trailing empty paragraphs in
  columns are not serialised. `columnsColumn` is the first contentful React node view:
  `NodeViewWrapper` + `NodeViewContent`, without `editableReactNodeView` (PM manages contenteditable
  inside the contentDOM itself). The flex size lives on the `.react-renderer` wrapper that Tiptap
  puts between the PM node and the React component. The "+"/"×" controls on hover rebuild the
  columnsList in a single transaction with focus in the new paragraph; a minimum of 2 columns — "×"
  is limited by the contract.
- **Equations use KaTeX (`katex`, HTML output).** The block `equation` is an atom with `expression` in
  attrs; a click opens a textarea (Ctrl+Enter/Escape/blur), and an empty one opens itself right after
  insertion; a parse error shows the raw LaTeX. The inline equation is a **new rich-text segment
  variant** `{math}` (not a mark: an equation has no carrier text). `RichText` was extended with the
  union variant; `richToPlain` returns the expression as text; math segments work in all rich fields
  (including table cells and toggle) for free — the conversion is shared.
- **A page link is `linkToPage` with a single `pageId`.** Unlike `page` (a subpage) it denormalises
  nothing: the title and icon are fetched when displaying, so renaming the target page does not break
  the block. Without a `pageId` the node is not serialised, and the node view shows a picker dialog:
  a flat list of the space's pages (walking to depth 4) plus search by name (shadcn Dialog + Input).
- **Breadcrumbs are `breadcrumb` with no payload.** The path is computed by the node view by walking
  up `parentId` (the same logic as the header, but through the bridge). It renders a shadcn
  Breadcrumb; the separator is a sibling `BreadcrumbItem` (see ADR 0022 about li-in-li); navigation
  uses `router.push` from the bridge.
- **The page bridge (`utils/page-link.ts`)** follows the sub-page pattern: node views are rendered by
  ReactRenderer outside the app tree, so context and hooks do not reach them. The bridge is assigned
  **during render**, not in an effect: node views mount before the parent's effects and read the page
  on start; values stay live through getters (workspaceId/pageId are read from a ref at call time).
- **An incidental bubble-menu fix:** the custom `shouldShow` lost the focus check — the menu hung over
  a selection while the user typed an equation in the textarea. `currentEditor.isFocused` was added.

## Alternatives

- **`@tiptap/extension-mathematics`.** Stores `$…$` as text with input rules — conflicts with the
  segment-based rich-text model and gives "retype the raw source" editing rather than Notion's click
  popup.
- **Columns as separate blocks with `parentColumnId`.** Column order and boundaries would scatter
  across N rows with fractional indexing; an atomic `columns` row reuses the proven toggle model.
- **Dragging to resize columns.** Requires storing widths and complex geometry; postponed — created
  columns are equal, and the composition changes via the "+"/"×" buttons.

## Consequences

- The contract schema gained 4 types and the `{math}` variant; older clients (pre-deployment) reject
  new blocks with status 400 — a single release of frontend and services is mandatory (the workers
  were restarted).
- Column children are not visible to autosave as separate rows: any change inside a column rewrites
  the whole columns row (as with toggle) — acceptable at current document sizes.
- The slash command list has grown to 26 items; the count tests were updated.
