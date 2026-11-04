import type { MetadataRoute } from 'next';

/**
 * Workspace content is per-account and never public, so it stays out of the
 * index. The marketing entry points remain crawlable.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/workspaces/', '/api/'],
    },
  };
}
