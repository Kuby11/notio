import type { Page } from '@notio/contracts';
import { PageResponseSchema, PageListResponseSchema } from '../types/dto';

/**
 * Маппер DTO ↔ доменная сущность.
 *
 * Сервер отдаёт Page в том же виде, что и контракт, поэтому маппер здесь
 * минимален: проверка схемой + возврат. Отдельный слой нужен, чтобы при
 * изменении контракта (новое поле) мы меняли только здесь, а не везде.
 */
export function toPage(dto: unknown): Page {
  return PageResponseSchema.parse(dto);
}

export function toPageList(dto: unknown): { items: Page[]; nextCursor: string | null } {
  return PageListResponseSchema.parse(dto);
}
