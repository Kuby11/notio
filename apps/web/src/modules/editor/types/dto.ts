import { BlockListResultSchema, BlockSchema } from '@notio/contracts';

/**
 * Editor DTO responses: the shape is set by the contracts, this file is only
 * the validation point at the network boundary.
 */
export const BlockResponseSchema = BlockSchema;
export const BlockListResponseSchema = BlockListResultSchema;
