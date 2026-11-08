import type { Database, DatabaseProperty } from '@notio/contracts';

/**
 * Asserts that the title of a database is within allowed limits.
 */
export function assertValidDatabaseTitle(title: string): void {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw new Error('Database name cannot be empty');
  }
  if (trimmed.length > 500) {
    throw new Error('Database name cannot exceed 500 characters');
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
    throw new Error('Property name cannot be empty');
  }
  if (trimmed.length > 255) {
    throw new Error('Property name cannot exceed 255 characters');
  }

  const normalized = trimmed.toLowerCase();
  const duplicate = existingProperties.some(
    (p) => p.id !== excludePropertyId && p.name.trim().toLowerCase() === normalized,
  );
  if (duplicate) {
    throw new Error(`Property "${trimmed}" already exists`);
  }
}

/**
 * Returns the primary title property of the database.
 */
export function findTitleProperty(database: Database): DatabaseProperty {
  const titleProp = database.properties.find((p) => p.type === 'title');
  if (!titleProp) {
    throw new Error('Database must have exactly one title property');
  }
  return titleProp;
}
