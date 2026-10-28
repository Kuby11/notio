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

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta');

  return { title: t('title'), description: t('description') };
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
