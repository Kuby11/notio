import { z } from 'zod';

/**
 * Single access point for frontend environment variables (see .agents/AGENTS.md, item 10).
 * Anything that fails validation breaks the build instead of silently shipping.
 * Only NEXT_PUBLIC_* reaches the client: there are no frontend secrets.
 */
const DEV_GATEWAY_URL = 'http://localhost:8787';

/**
 * A production bundle must name its gateway.
 *
 * The schema used to default to `http://localhost:8787` everywhere, so a
 * deployment without the variable shipped a URL that only resolves on a
 * developer machine — and every request failed with a network error that
 * looked like a server outage. The build now fails instead.
 */
if (process.env.NODE_ENV === 'production' && !process.env['NEXT_PUBLIC_GATEWAY_URL']) {
  throw new Error('NEXT_PUBLIC_GATEWAY_URL is required for a production build');
}

const ClientEnvSchema = z.object({
  NEXT_PUBLIC_GATEWAY_URL: z
    .url()
    .refine((value) => value.startsWith('https://') || value.startsWith('http://'), {
      message: 'Gateway URL must use the http(s) scheme',
    })
    .default(DEV_GATEWAY_URL),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('notio'),
});

export const env = ClientEnvSchema.parse({
  NEXT_PUBLIC_GATEWAY_URL: process.env['NEXT_PUBLIC_GATEWAY_URL'],
  NEXT_PUBLIC_APP_NAME: process.env['NEXT_PUBLIC_APP_NAME'],
});

export type ClientEnv = z.infer<typeof ClientEnvSchema>;
