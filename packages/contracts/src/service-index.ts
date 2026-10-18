import { z } from 'zod';

/** Имя приложения notio: используется и в контракте, и в UI. */
export const APP_NAME = 'notio';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const ApiEndpointSchema = z.object({
  method: z.enum(HTTP_METHODS),
  path: z.string().startsWith('/'),
  description: z.string().min(1),
});
export type ApiEndpoint = z.infer<typeof ApiEndpointSchema>;

/** Ответ `GET /` — индекс публичного API gateway. */
export const ServiceIndexSchema = z.object({
  name: z.literal(APP_NAME),
  version: z.string().min(1),
  endpoints: z.array(ApiEndpointSchema),
});
export type ServiceIndex = z.infer<typeof ServiceIndexSchema>;
