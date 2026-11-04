import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import { AppProviders } from '../core/providers';
import { TooltipProvider } from '@/shared/ui/tooltip';
import './globals.css';
import { Geist } from 'next/font/google';
import { cn } from '@/shared/ui/utils';
import { THEME_APPLY_SCRIPT } from '../core/ui/theme';
import { env } from '../shared/configs/env';

// Cyrillic is part of the product: the interface ships a Russian locale, so a
// Latin-only subset would render it with a fallback font.
const geist = Geist({ subsets: ['latin', 'cyrillic'], variable: '--font-sans' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');
  const description = t('description');
  // Canonical origin for social images and absolute URLs. It is optional: a
  // deployment without it keeps relative metadata instead of inventing a host.
  const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'];

  return {
    ...(siteUrl === undefined ? {} : { metadataBase: new URL(siteUrl) }),
    title: {
      default: t('title'),
      template: `%s — ${env.NEXT_PUBLIC_APP_NAME}`,
    },
    description,
    applicationName: env.NEXT_PUBLIC_APP_NAME,
    openGraph: {
      type: 'website',
      siteName: env.NEXT_PUBLIC_APP_NAME,
      title: t('title'),
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description,
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The locale is read by i18n/request.ts from the NEXT_LOCALE cookie (no URL prefix).
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    // suppressHydrationWarning: the dark class is set by an inline script before hydration.
    <html lang={locale} className={cn('font-sans', geist.variable)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_APPLY_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppProviders>
            {/* Slight delay: instant tooltips flicker while the cursor moves
                across rows of bubble-menu buttons and table pills. */}
            <TooltipProvider delay={200}>{children}</TooltipProvider>
          </AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
