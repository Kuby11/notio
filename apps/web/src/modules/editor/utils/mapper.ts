import type { Block } from '@notio/contracts';
import { BlockResponseSchema, BlockListResponseSchema } from '../types/dto';

export function toBlock(dto: unknown): Block {
  return BlockResponseSchema.parse(dto);
}

export function toBlockList(dto: unknown): { items: Block[]; nextCursor: string | null } {
  return BlockListResponseSchema.parse(dto);
}
