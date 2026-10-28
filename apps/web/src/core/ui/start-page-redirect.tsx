'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { readLastPage } from '../preferences/last-page';
import { usePreferences } from '../preferences/preferences.store';

/** Marks that the workspace was already opened in this tab. */
function startKey(workspaceId: string): string {
  return `notio-start-redirect:${workspaceId}`;
}

function alreadyRedirected(workspaceId: string): boolean {
  try {
    return window.sessionStorage.getItem(startKey(workspaceId)) !== null;
  } catch {
    return true;
  }
}

function markRedirected(workspaceId: string): void {
  try {
    window.sessionStorage.setItem(startKey(workspaceId), '1');
  } catch {
    // Storage is a convenience here: without it the workspace home is simply shown.
  }
}

/**
 * Sends a freshly opened workspace to the last visited page when the "open on
 * start" preference asks for it.
 *
 * Only the first visit of a tab session redirects: otherwise the workspace
 * home would be impossible to reach — every click on the workspace name would
 * bounce back to the last page.
 */
export function StartPageRedirect({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const { startPage, hydrated } = usePreferences();

  useEffect(() => {
    if (!hydrated || startPage !== 'last' || alreadyRedirected(workspaceId)) {
      return;
    }

    markRedirected(workspaceId);

    const pageId = readLastPage(workspaceId);

    if (pageId !== null) {
      router.replace(`/workspaces/${workspaceId}/${pageId}`);
    }
  }, [hydrated, startPage, workspaceId, router]);

  return null;
}
