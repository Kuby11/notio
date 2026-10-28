import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RegisterForm } from '@/modules/auth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');

  return { title: t('registerTitle') };
}

/**
 * Registration page: composition only, the logic lives in the auth feature.
 *
 * `?error=` is the provider code an OAuth redirect brings back on failure.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { error } = await searchParams;

  return <RegisterForm providerError={firstValue(error)} />;
}

/** A repeated query parameter arrives as an array: the first value wins. */
function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}
