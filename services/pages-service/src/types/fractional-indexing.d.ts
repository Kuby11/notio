/**
 * Библиотека fractional-indexing не публикует типы.
 * Объявляем только используемый API: ключ строго между двумя соседями.
 */
declare module 'fractional-indexing' {
  /**
   * Возвращает позицию строго между `before` и `after`.
   * `null` означает границу списка: начало или конец.
   */
  export function generateKeyBetween(before: string | null, after: string | null): string;

  /** Возвращает `count` позиций строго между `before` и `after`. */
  export function generateNKeysBetween(
    before: string | null,
    after: string | null,
    count: number,
  ): string[];
}