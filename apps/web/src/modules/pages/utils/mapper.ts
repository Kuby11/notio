import type { Page } from '@notio/contracts';
import { PageResponseSchema, PageListResponseSchema } from '../types/dto';

/**
 * DTO ↔ domain entity mapper.
 *
 * The server returns Page in the contract's shape, so the mapper here is
 * minimal: schema validation plus return. The separate layer exists so that
 * a contract change (a new field) is edited only here, not everywhere.
 */
export function toPage(dto: unknown): Page {
  return PageResponseSchema.parse(dto);
}

export function toPageList(dto: unknown): { items: Page[]; nextCursor: string | null } {
  return PageListResponseSchema.parse(dto);
}
