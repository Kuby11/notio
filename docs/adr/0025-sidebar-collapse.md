# ADR 0025. Sidebar collapse: full disappearance and a button in the top bar

- **Status:** accepted
- **Date:** 2026-10-28

## Context

The collapsed sidebar used to turn into a narrow rail with a single "expand" button, while the
collapse button itself sat on a separate row above search. Three problems came out of that: the rail
took 40–48 px from the content and looked like a second, "half-empty" sidebar; the collapse button
hung on its own row and was not visually tied to the panel's right edge; and the library route
(`/workspaces/:id`) has no top bar, so a collapsed panel could only be restored with a keyboard
shortcut.

## Decision

- **The panel disappears entirely.** The `aside` animates its width (`w-64` → `w-0`, 300 ms,
  `cubic-bezier(0.32, 0.72, 0, 1)`), the inner column keeps a fixed `w-64` width and is clipped by
  `overflow-hidden` — content does not reflow as it shrinks, it slides past the edge and fades out by
  `opacity`. The border moved from the `aside` to the inner column, so it disappears together with the
  width. There is no rail.
- **The collapse button gets its own row above the workspace switcher.** The top of the panel: a row
  with only the `PanelLeftClose` button at the right edge, below it the full-width workspace switcher,
  then search. The button has a tooltip hinting at `Ctrl + /`.
- **The expand button lives in the shell, one per page.** `AppLayout` renders
  `core/ui/sidebar-open-button.tsx` as `fixed top-3 left-3 z-40` over the content's left padding: the
  button is visible on any shell route, including those without their own header (home, library).
  Previously the page header rendered it, and on screens without a header a collapsed panel could
  only be restored with the keyboard. While the panel is collapsed, `main` keeps a `pl-12` padding and
  the sticky `PageHeader` panel grows by that padding (`-ml-12 pl-12`) — the button never covers the
  title or breadcrumbs, and the header border still reaches the edge. The button is marked
  `aria-controls="app-sidebar"` and `aria-expanded`, and appears with
  `animate-in fade-in-0 zoom-in-95`.
- **The markup stays mounted.** The page tree keeps its expanded nodes, and `Ctrl+K` works with the
  panel closed (the search dialog lives outside the `aside`). Hidden content is marked `aria-hidden`
  and `inert`: Tab does not go into invisible links.
- **Focus is removed before `inert` is applied.** Clicking the collapse button calls `blur()`:
  otherwise the browser blocks `aria-hidden` on an ancestor of the focused element.
- **State lives in `core/stores/sidebar.store.ts`.** `AppLayout` remounts on navigation, so `collapsed`
  cannot live in its props; the store survives transitions. `SIDEBAR_ID` is exported from there too,
  so `aria-controls` cannot drift between components.

## Alternatives

- **An icon rail (as in VS Code).** Gives quick access to sections without expanding, but requires a
  second set of icons and labels, takes width from the document and duplicates navigation that the
  top bar already provides.
- **Unmounting the panel on collapse.** Cheaper on the DOM, but loses the tree's expanded nodes and
  `Ctrl+K`, and the closing animation becomes a jolt: content disappears before the width collapses.
- **Keeping `collapsed` in `AppLayout` state.** Simpler in terms of props, but the shell remounts on
  every navigation — the panel would expand again whenever any page is clicked.
- **The expand button in every page header.** That was the first version: it worked in the editor,
  but routes without a header were left without a button, and every new route required manually
  inserting the component. A floating button in the shell removes both problems; the price is the
  `pl-12` content padding while the panel is collapsed.

## Consequences

- A collapsed panel takes no pixels; the transition is animated both ways, and content fades in and
  out together with the width.
- `Ctrl+/` toggles the panel on any shell screen, and the floating button in the left padding is the
  mouse route back; a new shell route gets it automatically.
- While the panel is collapsed, content is shifted 12 spacing units right (`pl-12` instead of `px-6`);
  pages that draw their own full-width sticky panel must account for that padding with a negative
  margin.
