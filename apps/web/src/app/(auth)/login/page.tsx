import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/modules/auth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');

  return { title: t('loginTitle') };
}

/**
 * The login page is thin: composition only. The form and the logic live in the auth feature.
 *
 * `?error=` is the provider code an OAuth redirect brings back on failure; the
 * form turns it into a message instead of leaving the user with a silent bounce.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;

  return <LoginForm providerError={firstValue(error)} />;
}

/** A repeated query parameter arrives as an array: the first value wins. */
function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
