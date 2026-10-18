import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { env } from '../shared/config/env';
import './globals.css';

export const metadata: Metadata = {
  title: `${env.NEXT_PUBLIC_APP_NAME} — клон Notion на Cloudflare`,
  description:
    'Портфолио-проект: рабочие пространства, блочный редактор и групповое редактирование в реальном времени на микросервисах Cloudflare Workers.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
