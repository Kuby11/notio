import { z } from 'zod';

/**
 * Идентификаторы сущностей — UUID версии 4 (решение ADR 0006).
 * Генерируются на стороне сервиса, поэтому в базе лежат как TEXT.
 */
export const IdSchema = z.uuidv4();
export type Id = z.infer<typeof IdSchema>;

/** Новый идентификатор. Криптостойкий источник — WebCrypto, доступный в Workers. */
export function newId(): Id {
  return IdSchema.parse(crypto.randomUUID());
}

/** Слаг рабочего пространства: маленькие латинские буквы, цифры и дефис. */
export const SlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Слаг: латиница в нижнем регистре, цифры и дефисы');

export type Slug = z.infer<typeof SlugSchema>;

/**
 * Порядок в дереве страниц — fractional indexing (решение ADR 0006).
 * Строка всегда лексикографически больше предыдущей и меньше следующей,
 * поэтому вставка между соседями не требует перезаписи других строк.
 */
export const PositionSchema = z.string().min(1);
export type Position = z.infer<typeof PositionSchema>;

export const IsoDateTimeSchema = z.iso.datetime();
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;

/**
 * URL только со схемой http(s).
 *
 * `z.url()` проверяет URL синтаксически и пропускает `javascript:alert(1)`,
 * поэтому схему дополнительно сужаем: в пользовательский контент попадают
 * только http(s)-ссылки (см. правила безопасности в .agents/AGENTS.md).
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
  { message: 'Разрешены только http(s)-ссылки' },
);

export type HttpUrl = z.infer<typeof HttpUrlSchema>;
