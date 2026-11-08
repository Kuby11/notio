import { z } from 'zod';

/**
 * Entity ids are UUID v4 (decision in ADR 0006).
 * They are generated service-side, which is why they are stored as TEXT.
 */
export const IdSchema = z.uuidv4();
export type Id = z.infer<typeof IdSchema>;

/** A new id. The cryptographically secure source is WebCrypto, available in Workers. */
export function newId(): Id {
  return IdSchema.parse(crypto.randomUUID());
}

/** Workspace slug: lowercase Latin letters, digits and hyphens. */
export const SlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug: lowercase Latin letters, digits and hyphens');

export type Slug = z.infer<typeof SlugSchema>;

/**
 * Ordering in the page tree uses fractional indexing (decision in ADR 0006).
 * A string is always lexicographically greater than the previous one and
 * smaller than the next, so inserting between neighbours never rewrites
 * the other keys.
 */
export const PositionSchema = z.string().min(1);
export type Position = z.infer<typeof PositionSchema>;

export const IsoDateTimeSchema = z.iso.datetime();
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/**
 * URLs with the http(s) scheme only.
 *
 * `z.url()` validates a URL syntactically and lets `javascript:alert(1)`
 * through, so the scheme is narrowed further: only http(s) links reach user
 * content (see the security rules in .agents/AGENTS.md).
 */
export const HttpUrlSchema = z.url().refine(
  (value) => {
    try {
      const { protocol } = new URL(value);
      return protocol === 'http:' || protocol === 'https:';
    } catch {
      return false;
    }
  },
  { message: 'Only http(s) URLs are allowed' },
);

export type HttpUrl = z.infer<typeof HttpUrlSchema>;
