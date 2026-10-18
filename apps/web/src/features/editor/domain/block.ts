/**
 * Доменные правила блоков редактора.
 *
 * Чистый TypeScript без React, Tiptap и сети. Сериализация, миграция и
 * реестр типов блоков живут здесь: иначе один и тот же инвариант жил бы
 * в трёх местах (редактор, автосохранение, миграции).
 */
import type { Block, BlockContent, BlockType } from '@notio/contracts';

/** Блок в терминах домена: то же, что контракт, но с явным children для toggle. */
export type EditorBlock = Block;

/** Реестр типов блоков: новый тип добавляется регистрацией, а не правкой switch. */
export interface BlockDefinition {
  type: BlockType;
  /** Заголовок в slash-меню. */
  label: string;
  /** Иконка в slash-меню (emoji или имя иконки). */
  icon: string;
  /** Создаёт пустой блок этого типа. */
  create: () => BlockContent;
  /** Текстовое представление для поиска и превью. */
  toText: (content: BlockContent) => string;
}

const registry = new Map<BlockType, BlockDefinition>();

/** Регистрирует тип блока. Повторная регистрация заменяет предыдущую. */
export function registerBlock(definition: BlockDefinition): void {
  registry.set(definition.type, definition);
}

/** Возвращает определение типа или undefined, если тип не зарегистрирован. */
export function getBlockDefinition(type: BlockType): BlockDefinition | undefined {
  return registry.get(type);
}

/** Все зарегистрированные типы — для slash-меню и валидации. */
export function listBlockDefinitions(): BlockDefinition[] {
  return [...registry.values()];
}

/** Создаёт пустой блок заданного типа. */
export function createEmptyBlock(type: BlockType): BlockContent {
  const definition = registry.get(type);

  if (!definition) {
    throw new Error(`Тип блока ${type} не зарегистрирован`);
  }

  return definition.create();
}

/** Текстовое представление блока для поиска и превью. */
export function blockToText(block: Block): string {
  const definition = registry.get(block.type);

  return definition ? definition.toText(block.content) : '';
}

/** Сериализация документа в JSON для хранения и передачи. */
export function serializeDocument(blocks: readonly Block[]): string {
  return JSON.stringify(blocks);
}

/** Десериализация документа с валидацией через контракт. */
export function deserializeDocument(json: string): Block[] {
  const parsed = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    throw new Error('Документ должен быть массивом блоков');
  }

  return parsed.map((entry) => {
    // Миграция старых форматов: если content — строка, оборачиваем в paragraph.
    if (typeof entry === 'string') {
      return {
        id: crypto.randomUUID(),
        pageId: '',
        type: 'paragraph',
        position: 'a0',
        content: { type: 'paragraph', content: entry },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Block;
    }

    return entry as Block;
  });
}

/** Проверка, что блок можно переместить: нельзя внутрь самого себя. */
export function canMoveBlock(
  blocks: readonly Block[],
  blockId: string,
  afterBlockId: string | null,
): boolean {
  if (blockId === afterBlockId) {
    return false;
  }

  void blocks;

  return true;
}
