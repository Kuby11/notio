import { bindings, defineConfig, defineWorker } from 'cf/config';

export default defineConfig({
  worker: defineWorker({
    name: 'notio-web',
    entrypoint: 'vinext/server/fetch-handler',
    compatibilityDate: '2026-11-04',
    compatibilityFlags: ['nodejs_compat'],
    assets: {
      htmlHandling: 'none',
      notFoundHandling: 'none',
      runWorkerFirst: ['/*', '!/_next/static/*', '!/*/_next/static/*'],
    },
    env: {
      ASSETS: bindings.assets(),
      // The same-origin auth proxy (src/app/api/auth/[...auth]/route.ts) reaches
      // the gateway through a Service binding, not a public URL. workers.dev is
      // on the Public Suffix List, and Cloudflare blocks same-zone
      // Worker-to-Worker subrequests by public hostname with error 1042 — the
      // proxy answered 404 in production while working locally.
      GATEWAY: bindings.worker({ worker: 'notio-gateway' }),
    },
  }),
});
