import { BlockListResultSchema, BlockSchema } from '@notio/contracts';

/**
 * DTO-ответы редактора: форма задана контрактами, здесь только точка
 * валидации на границе сети.
 */
export const BlockResponseSchema = BlockSchema;
export const BlockListResponseSchema = BlockListResultSchema;
