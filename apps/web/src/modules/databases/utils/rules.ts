import type { Database, DatabaseProperty } from '@notio/contracts';

/**
 * Asserts that the title of a database is within allowed limits.
 */
export function assertValidDatabaseTitle(title: string): void {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new Error('Название базы данных не может быть пустым');
  }
  if (trimmed.length > 500) {
    throw new Error('Название базы данных не может превышать 500 символов');
  }
}

/**
 * Asserts that a property name is valid and unique within the database.
 */
export function assertValidPropertyName(
  name: string,
  existingProperties: DatabaseProperty[],
  excludePropertyId?: string,
): void {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Название свойства не может быть пустым');
  }
  if (trimmed.length > 255) {
    throw new Error('Название свойства не может превышать 255 символов');
  }

  const normalized = trimmed.toLowerCase();
  const duplicate = existingProperties.some(
    (p) => p.id !== excludePropertyId && p.name.trim().toLowerCase() === normalized,
  );
  if (duplicate) {
    throw new Error(`Свойство с именем «${trimmed}» уже существует`);
  }
}

/**
 * Returns the primary title property of the database.
 */
export function findTitleProperty(database: Database): DatabaseProperty {
  const titleProp = database.properties.find((p) => p.type === 'title');
  if (!titleProp) {
    throw new Error('База данных должна иметь ровно одно свойство title');
  }
  return titleProp;
}
