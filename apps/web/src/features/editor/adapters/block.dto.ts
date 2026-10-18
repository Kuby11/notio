import { z } from 'zod';
import { BlockListResultSchema, BlockSchema } from '@notio/contracts';

export const BlockResponseSchema = BlockSchema;
export const BlockListResponseSchema = BlockListResultSchema;

// z используется для типов.
void z;
