'use client';

import { useEffect } from 'react';
import { storeLastPage, storePageVisit } from '../preferences/last-page';

/**
 * Remembers the page a user is on: "open on start" returns to it, and the
 * library table reads the same record for its "last visited time" column.
 */
export function LastPageTracker({ workspaceId, pageId }: { workspaceId: string; pageId: string }) {
  useEffect(() => {
    storeLastPage(workspaceId, pageId);
    storePageVisit(workspaceId, pageId);
  }, [workspaceId, pageId]);

  return null;
}
