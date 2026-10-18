import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  /** Внутренние пакеты отдаются исходниками TS — сборка не нужна. */
  transpilePackages: ['@notio/contracts'],
  /** Не раскрываем факт использования Next.js в заголовках ответа. */
  poweredByHeader: false,
};

export default nextConfig;
