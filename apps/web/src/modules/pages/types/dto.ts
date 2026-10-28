import type { z } from 'zod';
import { PageListResultSchema, PageSchema } from '@notio/contracts';

/**
 * DTO responses from pages-service.
 *
 * The network is not trusted: everything that comes in is validated by Zod before
 * it reaches the domain model. Schemas come from `@notio/contracts` —
 * the single source of truth for data shape.
 */
export const PageResponseSchema = PageSchema;
export const PageListResponseSchema = PageListResultSchema;

export type PageResponse = z.infer<typeof PageResponseSchema>;
export type PageListResponse = z.infer<typeof PageListResponseSchema>;
