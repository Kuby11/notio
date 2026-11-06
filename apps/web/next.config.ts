const DEFAULT_GATEWAY_URL = 'http://localhost:8787';
const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * The gateway is a separate origin, so it must be named explicitly in
 * `connect-src`/`img-src`. Anything unparsable is left out rather than
 * widened to `*`.
 */
function gatewayOrigin(): string {
  try {
    return new URL(process.env['NEXT_PUBLIC_GATEWAY_URL'] ?? DEFAULT_GATEWAY_URL).origin;
  } catch {
    return '';
  }
}

/**
 * Baseline CSP.
 *
 * `script-src` still needs `'unsafe-inline'`: the framework inlines its
 * hydration bootstrap and the theme script, and a nonce-based policy requires
 * middleware that rewrites every response. That is the remaining gap; every
 * other directive is restrictive, and `eval` is allowed only in development
 * where React Refresh needs it.
 */
function contentSecurityPolicy(): string {
  const gateway = gatewayOrigin();
  const websocket = gateway.replace(/^http/u, 'ws');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    // OAuth-провайдеры отдают аватары со своих CDN — они нужны в img-src.
    `img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com ${gateway}`.trim(),
    `media-src 'self' blob: ${gateway}`.trim(),
    `connect-src 'self' ${gateway} ${websocket}`.trim(),
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ');
}

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  ...(isDevelopment
    ? []
    : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]),
];

/**
 * Consumed by vinext at dev/build time: it reuses the `headers()` hook,
 * `transpilePackages` and `poweredByHeader` from the Next config format.
 */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@notio/contracts'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
