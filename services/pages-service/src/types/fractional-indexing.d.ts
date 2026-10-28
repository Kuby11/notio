/**
 * The fractional-indexing library ships no types.
 * We declare only the API we use: a key strictly between two neighbours.
 */
declare module 'fractional-indexing' {
  /**
   * Returns a position strictly between `before` and `after`.
   * `null` means a list boundary: start or end.
   */
  export function generateKeyBetween(before: string | null, after: string | null): string;

  /** Returns `count` positions strictly between `before` and `after`. */
  export function generateNKeysBetween(
    before: string | null,
    after: string | null,
    count: number,
  ): string[];
}