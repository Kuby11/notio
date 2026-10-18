import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppProviders } from '../core/providers';
import { env } from '../shared/config/env';
import './globals.css';
import { Geist } from 'next/font/google';
import { cn } from '@/shared/lib/utils';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: `${env.NEXT_PUBLIC_APP_NAME} — клон Notion на Cloudflare`,
  description:
    'Портфолио-проект: рабочие пространства, блочный редактор и групповое редактирование в реальном времени на микросервисах Cloudflare Workers.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className={cn('font-sans', geist.variable)}>
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
