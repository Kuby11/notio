import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

/**
 * Section metadata for the workspace routes.
 *
 * Child routes override the title with the workspace or page name through
 * their own `generateMetadata`; this layout only names the section itself, so
 * `/workspaces` gets a meaningful `<title>` instead of the site default.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('workspace');

  return { title: t('listTitle') };
}

export default function WorkspacesLayout({ children }: { children: ReactNode }) {
  return children;
}
