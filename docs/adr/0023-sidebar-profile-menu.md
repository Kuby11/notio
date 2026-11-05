# ADR 0023. Sidebar profile: a single popover instead of the workspace switcher

- **Status:** accepted
- **Date:** 2026-10-25

## Context

At the top of the sidebar there was a separate "Select workspace" dropdown (a list plus an inline
creation form). The user's profile (name, email) was shown nowhere, and signing out was only possible
from the sign-in page. A profile button with a popover was needed: a user card, all workspaces,
creating a new one, settings and sign-out.

## Decision

- **The profile button replaces the workspace switcher.** The button shows avatar initials and the
  name; the workspace list (with a check mark on the active one) and the creation form moved inside
  the popover — two controls for one list would be redundant. The active workspace is still visible
  through the page tree below the button.
- **The avatar is a circle with initials.** The session contract has no image field for the user;
  once images appear, the initials will be replaced by an Avatar component without changing the
  structure.
- **Settings is a read-only profile dialog** (name, email, verification status). Editing the name
  would pull in an update-user call in the auth adapter; there was no request for it, so the dialog
  honestly shows the current state without pretending to be editable.
- **Sign-out uses the existing `useAuth().signOut` mutation** (clearing the JWT cache and the query
  cache) + a redirect to `/login`. A network error is not treated as signing out: we show a toast, and
  the interface does not pretend the user is logged out.
- **An incidental autosave fix:** a completely empty PM document serialises as `{type:'doc'}` without
  a `content` key; `editorDocumentToBlocks` crashed on it (TypeError), and an "empty" reset before
  hydration would erase server content. The parser tolerates a missing `content` (a legal "deleted
  everything"), and `onUpdate` does not queue an autosave until page hydration finishes.

## Consequences

- Creating a workspace from the popover redirects into the new space (`router.push` after the
  mutation) — previously the list simply refreshed.
- The sidebar no longer imports DropdownMenu for the switcher; the profile lives in
  `core/ui/profile-menu.tsx` (core assembles modules — useAuth + useWorkspaces).
- A real sign-out is not covered by browser E2E (it resets the stand's session); the
  `signOut → /login` path is checked at the hook's unit level.
