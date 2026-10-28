import { z } from 'zod';
import { IdSchema } from './ids';

/**
 * Query parameters arrive as strings, so booleans are parsed explicitly:
 * in JS any non-empty string is truthy, which would turn "false" into true.
 */
export const BooleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

/**
 * Child page list. `parentId: null` means the workspace root; an absent
 * parameter is equivalent to the root.
 */
export const PageListQuerySchema = z.object({
  workspaceId: IdSchema,
  parentId: IdSchema.nullable().default(null),
  includeTrashed: BooleanQuerySchema.default(false),
  /** Cursor over position: the next page starts strictly after it. */
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type PageListQuery = z.infer<typeof PageListQuerySchema>;

/**
 * Favorites are collected across the whole workspace rather than one tree
 * level: a favorited page can live at any nesting depth.
 */
export const PageFavoritesQuerySchema = z.object({
  workspaceId: IdSchema,
});
export type PageFavoritesQuery = z.infer<typeof PageFavoritesQuerySchema>;

/** The trash, like favorites, spans the whole workspace rather than one tree level. */
export const PageTrashQuerySchema = z.object({
  workspaceId: IdSchema,
});
export type PageTrashQuery = z.infer<typeof PageTrashQuerySchema>;

/** Page search across the workspace by title. */
export const PageSearchQuerySchema = z.object({
  workspaceId: IdSchema,
  q: z.string().trim().min(1).max(200),
});
export type PageSearchQuery = z.infer<typeof PageSearchQuerySchema>;

/**
 * Every page of the workspace in one flat list.
 *
 * The library view sorts and filters across the whole workspace and rebuilds
 * the nesting from `parentId` on the client, so it cannot be assembled level
 * by level: that would cost one request per expanded branch.
 */
export const PageAllQuerySchema = z.object({
  workspaceId: IdSchema,
});
export type PageAllQuery = z.infer<typeof PageAllQuerySchema>;
