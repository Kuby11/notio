/**
 * Last page opened in a workspace.
 *
 * Used by the "open on start" preference: remembering the page per workspace
 * keeps several workspaces independent. localStorage is browser-only, so every
 * read is guarded and falls back to "nothing remembered".
 */

const STORAGE_PREFIX = 'notio-last-page:';

export function readLastPage(workspaceId: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.localStorage.getItem(`${STORAGE_PREFIX}${workspaceId}`);

    return value === null || value.length === 0 ? null : value;
  } catch {
    return null;
  }
}

export function storeLastPage(workspaceId: string, pageId: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${workspaceId}`, pageId);
  } catch {
    // Quota or a disabled storage API: remembering the page is a convenience, not a requirement.
  }
}

/**
 * Per-page visit timestamps of a workspace.
 *
 * The server does not track reads, so "last visited time" in the library is a
 * local fact: opening a page writes its timestamp here. The map is capped —
 * the oldest entries are dropped — so a long-lived workspace cannot fill the
 * storage quota.
 */

const VISITS_PREFIX = 'notio-page-visits:';
const MAX_VISITS = 300;

export function readPageVisits(workspaceId: string): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(`${VISITS_PREFIX}${workspaceId}`);

    if (raw === null) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null) {
      return {};
    }

    const visits: Record<string, string> = {};

    for (const [pageId, at] of Object.entries(parsed)) {
      if (typeof at === 'string') {
        visits[pageId] = at;
      }
    }

    return visits;
  } catch {
    // Unreadable or disabled storage: the column simply shows no visits.
    return {};
  }
}

export function storePageVisit(workspaceId: string, pageId: string, at: Date = new Date()): void {
  if (typeof window === 'undefined') {
    return;
  }

  const visits = readPageVisits(workspaceId);
  visits[pageId] = at.toISOString();

  const capped = Object.entries(visits)
    .toSorted(([, left], [, right]) => right.localeCompare(left))
    .slice(0, MAX_VISITS);

  try {
    window.localStorage.setItem(
      `${VISITS_PREFIX}${workspaceId}`,
      JSON.stringify(Object.fromEntries(capped)),
    );
  } catch {
    // Same as above: a missing visit only costs one empty cell in the table.
  }
}
