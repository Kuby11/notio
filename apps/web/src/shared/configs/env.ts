import { z } from 'zod';

/**
 * Единая точка доступа к переменным окружения фронтенда (см. .agents/AGENTS.md, п. 10).
 * Всё, что не прошло валидацию, валит сборку, а не молча едет в бандл.
 * В клиент попадают только NEXT_PUBLIC_* — секретов на фронтенде нет.
 */
const ClientEnvSchema = z.object({
  NEXT_PUBLIC_GATEWAY_URL: z
    .url()
    .refine((value) => value.startsWith('https://') || value.startsWith('http://'), {
      message: 'Gateway URL должен использовать схему http(s)',
    })
    .default('http://localhost:8787'),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default('notio'),
});

export const env = ClientEnvSchema.parse({
  NEXT_PUBLIC_GATEWAY_URL: process.env['NEXT_PUBLIC_GATEWAY_URL'],
  NEXT_PUBLIC_APP_NAME: process.env['NEXT_PUBLIC_APP_NAME'],
});

export type ClientEnv = z.infer<typeof ClientEnvSchema>;
