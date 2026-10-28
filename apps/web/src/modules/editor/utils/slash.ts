import type { BlockType } from '@notio/contracts';

/** Действие, которое slash-команда применяет к текущему блоку. */
export type SlashCommandKind =
  | 'paragraph'
  | 'heading'
  | 'bulletList'
  | 'orderedList'
  | 'toDo'
  | 'toggle'
  | 'quote'
  | 'divider'
  | 'table'
  | 'page'
  | 'code'
  | 'image'
  | 'video'
  | 'file'
  | 'emoji'
  | 'columns'
  | 'equation'
  | 'inlineEquation'
  | 'linkToPage'
  | 'breadcrumb';

export interface SlashCommand {
  id: string;
  label: string;
  icon: string;
  /** Markdown-триггер, который Notion использует для этого блока. */
  markdown: string | null;
  kind: SlashCommandKind;
  headingLevel?: 1 | 2 | 3 | 4;
  /** Для kind 'columns': сколько колонок создать (2–5). */
  columnsCount?: 2 | 3 | 4 | 5;
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
    label: 'text',
    icon: '¶',
    markdown: null,
    kind: 'paragraph',
    blockType: 'paragraph',
    keywords: ['text', 'plain', 'paragraph', 'текст', 'абзац'],
  },
  {
    id: 'heading1',
    label: 'heading1',
    icon: 'H1',
    markdown: '#',
    kind: 'heading',
    headingLevel: 1,
    blockType: 'heading',
    keywords: ['h1', 'heading1', 'heading 1', 'heading', 'заголовок1', 'заголовок 1', '#'],
  },
  {
    id: 'heading2',
    label: 'heading2',
    icon: 'H2',
    markdown: '##',
    kind: 'heading',
    headingLevel: 2,
    blockType: 'heading',
    keywords: ['h2', 'heading2', 'heading 2', 'heading', 'заголовок2', 'заголовок 2', '##'],
  },
  {
    id: 'heading3',
    label: 'heading3',
    icon: 'H3',
    markdown: '###',
    kind: 'heading',
    headingLevel: 3,
    blockType: 'heading',
    keywords: ['h3', 'heading3', 'heading 3', 'heading', 'заголовок3', 'заголовок 3', '###'],
  },
  {
    id: 'heading4',
    label: 'heading4',
    icon: 'H4',
    markdown: '####',
    kind: 'heading',
    headingLevel: 4,
    blockType: 'heading',
    keywords: ['h4', 'heading4', 'heading 4', 'heading', 'заголовок4', 'заголовок 4', '####'],
  },
  {
    id: 'toggle',
    label: 'toggle',
    icon: '▸',
    markdown: '>',
    kind: 'toggle',
    blockType: 'toggle',
    keywords: ['toggle', 'toggle list', 'переключатель', 'сворачиваемый', '>'],
  },
  {
    id: 'numberedList',
    label: 'orderedList',
    icon: '1.',
    markdown: '1.',
    kind: 'orderedList',
    blockType: 'numberedListItem',
    keywords: ['num', 'numbered', 'numbered list', 'ordered', 'нумерованный', '1.'],
  },
  {
    id: 'checkList',
    label: 'toDo',
    icon: '☑',
    markdown: '[]',
    kind: 'toDo',
    blockType: 'toDo',
    keywords: ['todo', 'to-do', 'check', 'checklist', 'task', 'задача', 'чек', '[]'],
  },
  {
    id: 'bulletedList',
    label: 'bulletList',
    icon: '•',
    markdown: '-',
    kind: 'bulletList',
    blockType: 'bulletedListItem',
    keywords: ['bullet', 'bulleted', 'bulleted list', 'unordered', 'маркированный', '-'],
  },
  {
    id: 'quote',
    label: 'quote',
    icon: '❝',
    markdown: '"',
    kind: 'quote',
    blockType: 'quote',
    keywords: ['quote', 'blockquote', 'cite', 'цитата', 'цитировать', '"'],
  },
  {
    id: 'divider',
    label: 'divider',
    icon: '—',
    markdown: '---',
    kind: 'divider',
    blockType: 'divider',
    keywords: ['divider', 'hr', 'line', 'rule', 'разделитель', 'линия', '---'],
  },
  {
    id: 'table',
    label: 'table',
    icon: '▦',
    markdown: null,
    kind: 'table',
    blockType: 'table',
    keywords: ['table', 'grid', 'таблица', 'сетка', 'столбцы', 'строки'],
  },
  {
    id: 'page',
    label: 'page',
    icon: '📄',
    markdown: null,
    kind: 'page',
    blockType: 'page',
    keywords: ['page', 'subpage', 'sub-page', 'страница', 'подстраница', 'документ'],
  },
  {
    id: 'code',
    label: 'code',
    icon: '</>',
    markdown: '```',
    kind: 'code',
    blockType: 'code',
    keywords: ['code', 'snippet', 'код', 'фрагмент', '```'],
  },
  {
    id: 'image',
    label: 'image',
    icon: '🖼',
    markdown: null,
    kind: 'image',
    blockType: 'image',
    keywords: ['image', 'picture', 'img', 'изображение', 'картинка', 'фото'],
  },
  {
    id: 'video',
    label: 'video',
    icon: '▶',
    markdown: null,
    kind: 'video',
    blockType: 'video',
    keywords: ['video', 'movie', 'видео', 'ролик', 'mp4'],
  },
  {
    id: 'file',
    label: 'file',
    icon: '📎',
    markdown: null,
    kind: 'file',
    blockType: 'file',
    keywords: ['file', 'document', 'pdf', 'файл', 'документ', 'вложение'],
  },
  {
    id: 'emoji',
    label: 'emoji',
    icon: '😀',
    markdown: null,
    kind: 'emoji',
    blockType: 'emoji',
    keywords: ['emoji', 'smile', 'icon', 'эмодзи', 'смайл', 'иконка'],
  },
  {
    id: 'columns-2',
    label: 'columns-2',
    icon: '◫',
    markdown: null,
    kind: 'columns',
    columnsCount: 2,
    blockType: 'columns',
    keywords: ['columns', 'columns 2', 'колонки', '2 колонки', 'две колонки'],
  },
  {
    id: 'columns-3',
    label: 'columns-3',
    icon: '◫',
    markdown: null,
    kind: 'columns',
    columnsCount: 3,
    blockType: 'columns',
    keywords: ['columns', 'columns 3', 'колонки', '3 колонки', 'три колонки'],
  },
  {
    id: 'columns-4',
    label: 'columns-4',
    icon: '◫',
    markdown: null,
    kind: 'columns',
    columnsCount: 4,
    blockType: 'columns',
    keywords: ['columns', 'columns 4', 'колонки', '4 колонки', 'четыре колонки'],
  },
  {
    id: 'columns-5',
    label: 'columns-5',
    icon: '◫',
    markdown: null,
    kind: 'columns',
    columnsCount: 5,
    blockType: 'columns',
    keywords: ['columns', 'columns 5', 'колонки', '5 колонок', 'пять колонок'],
  },
  {
    id: 'equation',
    label: 'equation',
    icon: '∑',
    markdown: null,
    kind: 'equation',
    blockType: 'equation',
    keywords: ['equation', 'formula', 'math', 'latex', 'tex', 'формула', 'математика', 'уравнение'],
  },
  {
    id: 'inline-equation',
    label: 'inline-equation',
    icon: 'ƒ',
    markdown: null,
    kind: 'inlineEquation',
    blockType: 'equation',
    keywords: [
      'inline equation',
      'inline math',
      'строчная формула',
      'инлайн формула',
      'формула в тексте',
    ],
  },
  {
    id: 'link-to-page',
    label: 'link-to-page',
    icon: '🔗',
    markdown: null,
    kind: 'linkToPage',
    blockType: 'linkToPage',
    keywords: ['link to page', 'page link', 'ссылка на страницу', 'ссылка', 'упоминание страницы'],
  },
  {
    id: 'breadcrumb',
    label: 'breadcrumb',
    icon: '⌂',
    markdown: null,
    kind: 'breadcrumb',
    blockType: 'breadcrumb',
    keywords: ['breadcrumb', 'path', 'крошки', 'хлебные крошки', 'путь страницы'],
  },
];

export interface SlashRange {
  /** Позиция слэша в документе. */
  from: number;
  /** Позиция курсора в документе. */
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
