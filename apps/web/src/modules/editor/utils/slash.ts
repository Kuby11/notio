import type { BlockType } from '@notio/contracts';

/** Действие, которое slash-команда применяет к текущему блоку. */
export type SlashCommandKind =
  | 'paragraph'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'toDo'
  | 'toggle';

export interface SlashCommand {
  id: string;
  label: string;
  icon: string;
  /** Markdown-триггер, который Notion использует для этого блока. */
  markdown: string | null;
  kind: SlashCommandKind;
  headingLevel?: 1 | 2 | 3 | 4;
  blockType: BlockType;
  /** Синонимы для поиска: английские команды Notion и русские названия. */
  keywords: readonly string[];
}

/**
 * Базовые блоки из Notion.
 *
 * Порядок фиксирован: истории частых команд у нас пока нет, поэтому меню
 * не пересортировывается после каждого использования.
 */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: 'text',
    label: 'Текст',
    icon: '¶',
    markdown: null,
    kind: 'paragraph',
    blockType: 'paragraph',
    keywords: ['text', 'plain', 'paragraph', 'текст', 'абзац'],
  },
  {
    id: 'heading1',
    label: 'Заголовок 1',
    icon: 'H1',
    markdown: '#',
    kind: 'heading',
    headingLevel: 1,
    blockType: 'heading',
    keywords: ['h1', 'heading1', 'heading 1', 'heading', 'заголовок1', 'заголовок 1', '#'],
  },
  {
    id: 'heading2',
    label: 'Заголовок 2',
    icon: 'H2',
    markdown: '##',
    kind: 'heading',
    headingLevel: 2,
    blockType: 'heading',
    keywords: ['h2', 'heading2', 'heading 2', 'heading', 'заголовок2', 'заголовок 2', '##'],
  },
  {
    id: 'heading3',
    label: 'Заголовок 3',
    icon: 'H3',
    markdown: '###',
    kind: 'heading',
    headingLevel: 3,
    blockType: 'heading',
    keywords: ['h3', 'heading3', 'heading 3', 'heading', 'заголовок3', 'заголовок 3', '###'],
  },
  {
    id: 'heading4',
    label: 'Заголовок 4',
    icon: 'H4',
    markdown: '####',
    kind: 'heading',
    headingLevel: 4,
    blockType: 'heading',
    keywords: ['h4', 'heading4', 'heading 4', 'heading', 'заголовок4', 'заголовок 4', '####'],
  },
  {
    id: 'toggle',
    label: 'Toggle-список',
    icon: '▸',
    markdown: '>',
    kind: 'toggle',
    blockType: 'toggle',
    keywords: ['toggle', 'toggle list', 'переключатель', 'сворачиваемый', '>'],
  },
  {
    id: 'numberedList',
    label: 'Нумерованный список',
    icon: '1.',
    markdown: '1.',
    kind: 'orderedList',
    blockType: 'numberedListItem',
    keywords: ['num', 'numbered', 'numbered list', 'ordered', 'нумерованный', '1.'],
  },
  {
    id: 'checkList',
    label: 'Список задач',
    icon: '☑',
    markdown: '[]',
    kind: 'toDo',
    blockType: 'toDo',
    keywords: ['todo', 'to-do', 'check', 'checklist', 'task', 'задача', 'чек', '[]'],
  },
  {
    id: 'bulletedList',
    label: 'Маркированный список',
    icon: '•',
    markdown: '-',
    kind: 'bulletList',
    blockType: 'bulletedListItem',
    keywords: ['bullet', 'bulleted', 'bulleted list', 'unordered', 'маркированный', '-'],
  },
];

export interface SlashRange {
  /** Позиция слэша в документе. */
  from: number;
  /** Позиция курсора в документе. */
  to: number;
}

export interface SlashTrigger {
  query: string;
  /** Позиция слэша относительно начала текстового блока. */
  from: number;
  /** Позиция курсора относительно начала текстового блока. */
  to: number;
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/gu, ' ');
}

function scoreCommand(command: SlashCommand, query: string): number | null {
  const candidates = [command.label, command.id, ...command.keywords].map(normalize);
  let score: number | null = null;

  for (const candidate of candidates) {
    if (candidate === query) {
      return 0;
    }

    if (candidate.startsWith(query)) {
      score = score === null ? 1 : Math.min(score, 1);
    } else if (candidate.includes(query)) {
      score = score === null ? 2 : Math.min(score, 2);
    }
  }

  return score;
}

/**
 * Фильтрует команды по тексту после `/`.
 *
 * Сначала показываются точные совпадения (`/h2`), затем совпадения с начала
 * слова (`/head`), затем вхождения внутри названия или синонима.
 */
export function filterSlashCommands(query: string): SlashCommand[] {
  const normalized = normalize(query).replace(/^\/+/u, '');

  if (normalized.length === 0) {
    return [...SLASH_COMMANDS];
  }

  return SLASH_COMMANDS.map((command, index) => ({
    command,
    index,
    score: scoreCommand(command, normalized),
  }))
    .filter(
      (entry): entry is { command: SlashCommand; index: number; score: number } =>
        entry.score !== null,
    )
    .toSorted((left, right) => left.score - right.score || left.index - right.index)
    .map((entry) => entry.command);
}

/**
 * Ищет активный slash-триггер в тексте перед курсором.
 *
 * Notion открывает меню в начале блока или после пробела, но не внутри
 * слова/URL. Поэтому `/` должен стоять в начале строки или после whitespace,
 * а запрос не может содержать пробелы и второй слэш.
 */
export function detectSlashTrigger(textBeforeCursor: string): SlashTrigger | null {
  const match = /(^|\s)\/([^\s/]*)$/u.exec(textBeforeCursor);

  if (!match) {
    return null;
  }

  const query = match[2] ?? '';
  const from = textBeforeCursor.length - query.length - 1;

  return {
    query,
    from,
    to: textBeforeCursor.length,
  };
}
