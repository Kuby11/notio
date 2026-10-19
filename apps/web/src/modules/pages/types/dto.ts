import type { z } from 'zod';
import { PageListResultSchema, PageSchema } from '@notio/contracts';

/**
 * DTO-ответы pages-service.
 *
 * Сеть не считается доверенной: всё, что приходит, проверяется Zod до того,
 * как попадёт в доменную модель. Схемы берутся из `@notio/contracts` —
 * единственного источника правды о форме данных.
 */
export const PageResponseSchema = PageSchema;
export const PageListResponseSchema = PageListResultSchema;

export type PageResponse = z.infer<typeof PageResponseSchema>;
export type PageListResponse = z.infer<typeof PageListResponseSchema>;
