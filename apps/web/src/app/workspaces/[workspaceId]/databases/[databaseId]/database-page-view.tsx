'use client';

import { DatabaseView } from '@/modules/databases';

/**
 * Client boundary of the whole-page database route.
 *
 * The route file is a Server Component (it awaits `params`), while the
 * databases module barrel exports hooks. Importing the barrel from the server
 * file pulled `useState` into the RSC graph (build error), so the page passes
 * the id into this small client component instead.
 */
export function DatabasePageView({
  databaseId,
  initialViewId,
}: {
  databaseId: string;
  initialViewId?: string;
}) {
  return <DatabaseView databaseId={databaseId} initialViewId={initialViewId} />;
}
