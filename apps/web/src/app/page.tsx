'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useWorkspaces } from '@/modules/workspaces';

/**
 * The app home opens the library — the root of the user's workspace.
 *
 * The workspace is user-specific, so the choice happens on the client: the
 * first (oldest) workspace in the list — for a typical user that is the
 * personal workspace created automatically on registration. A brand-new user
 * is sent to the workspaces screen instead: it runs the welcome onboarding
 * (a fresh single workspace means a new user) and navigates into the editor
 * by itself.
 */
export default function Home() {
  const router = useRouter();
  const { data, isPending } = useWorkspaces().list;

  useEffect(() => {
    if (isPending) {
      return;
    }

    const workspaces = data ?? [];
    const oldest = workspaces.toSorted((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )[0];

    // Same freshness rule as the onboarding on the workspaces screen: a
    // workspace younger than a minute means the user was just created.
    const isNewUser =
      workspaces.length === 1 &&
      workspaces[0] !== undefined &&
      Date.now() - Date.parse(workspaces[0].createdAt) <= 60_000;

    if (oldest === undefined || isNewUser) {
      router.replace('/workspaces');

      return;
    }

    router.replace(`/workspaces/${oldest.id}`);
  }, [isPending, data, router]);

  // Nothing to render: the redirect happens as soon as the list arrives.
  return null;
}
