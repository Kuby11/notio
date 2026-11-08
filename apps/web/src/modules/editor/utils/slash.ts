import type { BlockType, DatabaseViewType } from '@notio/contracts';

/** Action a slash command applies to the current block. */
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
  | 'breadcrumb'
  | 'database'
  | 'databasePage'
  | 'chart';

export interface SlashCommand {
  id: string;
  label: string;
  icon: string;
  /** Markdown trigger Notion uses for this block. */
  markdown: string | null;
  kind: SlashCommandKind;
  headingLevel?: 1 | 2 | 3 | 4;
  /** For kind 'chart': the view type created for the inserted chart block. */
  chartType?: DatabaseViewType;
  /** For kind 'columns': how many columns to create (2–5). */
  columnsCount?: 2 | 3 | 4 | 5;
  blockType: BlockType;
  /** Search synonyms: Notion's English commands and common synonyms. */
  keywords: readonly string[];
}

/**
 * Basic Notion blocks.
 *
 * The order is fixed: we have no frequent-command history yet, so the menu
 * is not re-sorted after each use.
 */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: 'text',
    label: 'text',
    icon: '¶',
    markdown: null,
    kind: 'paragraph',
    blockType: 'paragraph',
    keywords: ['text', 'plain', 'paragraph', 'plain text', 'body text'],
  },
  {
    id: 'heading1',
    label: 'heading1',
    icon: 'H1',
    markdown: '#',
    kind: 'heading',
    headingLevel: 1,
    blockType: 'heading',
    keywords: ['h1', 'heading1', 'heading 1', 'heading', 'big heading', '#'],
  },
  {
    id: 'heading2',
    label: 'heading2',
    icon: 'H2',
    markdown: '##',
    kind: 'heading',
    headingLevel: 2,
    blockType: 'heading',
    keywords: ['h2', 'heading2', 'heading 2', 'heading', 'medium heading', '##'],
  },
  {
    id: 'heading3',
    label: 'heading3',
    icon: 'H3',
    markdown: '###',
    kind: 'heading',
    headingLevel: 3,
    blockType: 'heading',
    keywords: ['h3', 'heading3', 'heading 3', 'heading', 'small heading', '###'],
  },
  {
    id: 'heading4',
    label: 'heading4',
    icon: 'H4',
    markdown: '####',
    kind: 'heading',
    headingLevel: 4,
    blockType: 'heading',
    keywords: ['h4', 'heading4', 'heading 4', 'heading', 'smallest heading', '####'],
  },
  {
    id: 'toggle',
    label: 'toggle',
    icon: '▸',
    markdown: '>',
    kind: 'toggle',
    blockType: 'toggle',
    keywords: ['toggle', 'toggle list', 'toggle heading', 'collapsible', '>'],
  },
  {
    id: 'numberedList',
    label: 'orderedList',
    icon: '1.',
    markdown: '1.',
    kind: 'orderedList',
    blockType: 'numberedListItem',
    keywords: ['num', 'numbered', 'numbered list', 'ordered', 'ordered list', '1.'],
  },
  {
    id: 'checkList',
    label: 'toDo',
    icon: '☑',
    markdown: '[]',
    kind: 'toDo',
    blockType: 'toDo',
    keywords: ['todo', 'to-do', 'check', 'checklist', 'task', 'checkbox', '[]'],
  },
  {
    id: 'bulletedList',
    label: 'bulletList',
    icon: '•',
    markdown: '-',
    kind: 'bulletList',
    blockType: 'bulletedListItem',
    keywords: ['bullet', 'bulleted', 'bulleted list', 'unordered', 'unordered list', '-'],
  },
  {
    id: 'quote',
    label: 'quote',
    icon: '❝',
    markdown: '"',
    kind: 'quote',
    blockType: 'quote',
    keywords: ['quote', 'blockquote', 'cite', 'citation', 'callout', '"'],
  },
  {
    id: 'divider',
    label: 'divider',
    icon: '—',
    markdown: '---',
    kind: 'divider',
    blockType: 'divider',
    keywords: ['divider', 'hr', 'line', 'rule', 'separator', 'horizontal rule', '---'],
  },
  {
    id: 'table',
    label: 'table',
    icon: '▦',
    markdown: null,
    kind: 'table',
    blockType: 'table',
    keywords: ['table', 'grid', 'rows and columns', 'cells'],
  },
  {
    id: 'page',
    label: 'page',
    icon: '📄',
    markdown: null,
    kind: 'page',
    blockType: 'page',
    keywords: ['page', 'subpage', 'sub-page', 'child page', 'document'],
  },
  {
    id: 'code',
    label: 'code',
    icon: '</>',
    markdown: '```',
    kind: 'code',
    blockType: 'code',
    keywords: ['code', 'snippet', 'code block', 'code snippet', '```'],
  },
  {
    id: 'image',
    label: 'image',
    icon: '🖼',
    markdown: null,
    kind: 'image',
    blockType: 'image',
    keywords: ['image', 'picture', 'img', 'photo', 'pic'],
  },
  {
    id: 'video',
    label: 'video',
    icon: '▶',
    markdown: null,
    kind: 'video',
    blockType: 'video',
    keywords: ['video', 'movie', 'clip', 'mp4'],
  },
  {
    id: 'file',
    label: 'file',
    icon: '📎',
    markdown: null,
    kind: 'file',
    blockType: 'file',
    keywords: ['file', 'document', 'pdf', 'attachment', 'upload'],
  },
  {
    id: 'emoji',
    label: 'emoji',
    icon: '😀',
    markdown: null,
    kind: 'emoji',
    blockType: 'emoji',
    keywords: ['emoji', 'smile', 'icon', 'smiley', 'emoticon'],
  },
  {
    id: 'columns-2',
    label: 'columns-2',
    icon: '◫',
    markdown: null,
    kind: 'columns',
    columnsCount: 2,
    blockType: 'columns',
    keywords: ['columns', 'columns 2', 'two columns', 'column split'],
  },
  {
    id: 'columns-3',
    label: 'columns-3',
    icon: '◫',
    markdown: null,
    kind: 'columns',
    columnsCount: 3,
    blockType: 'columns',
    keywords: ['columns', 'columns 3', 'three columns', 'column split'],
  },
  {
    id: 'columns-4',
    label: 'columns-4',
    icon: '◫',
    markdown: null,
    kind: 'columns',
    columnsCount: 4,
    blockType: 'columns',
    keywords: ['columns', 'columns 4', 'four columns', 'column split'],
  },
  {
    id: 'columns-5',
    label: 'columns-5',
    icon: '◫',
    markdown: null,
    kind: 'columns',
    columnsCount: 5,
    blockType: 'columns',
    keywords: ['columns', 'columns 5', 'five columns', 'column split'],
  },
  {
    id: 'equation',
    label: 'equation',
    icon: '∑',
    markdown: null,
    kind: 'equation',
    blockType: 'equation',
    keywords: ['equation', 'formula', 'math', 'latex', 'tex', 'math expression'],
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
      'inline formula',
      'math in text',
      'text formula',
    ],
  },
  {
    id: 'link-to-page',
    label: 'link-to-page',
    icon: '🔗',
    markdown: null,
    kind: 'linkToPage',
    blockType: 'linkToPage',
    keywords: ['link to page', 'page link', 'page mention', 'mention page', 'link'],
  },
  {
    id: 'breadcrumb',
    label: 'breadcrumb',
    icon: '⌂',
    markdown: null,
    kind: 'breadcrumb',
    blockType: 'breadcrumb',
    keywords: ['breadcrumb', 'path', 'breadcrumbs', 'page path', 'page trail'],
  },
  {
    id: 'database-inline',
    label: 'databaseInline',
    icon: '🗂',
    markdown: null,
    kind: 'database',
    blockType: 'database',
    keywords: [
      'inline database',
      'database inline',
      'database',
      'db',
      'inline db',
      'inline table',
    ],
  },
  {
    id: 'database-page',
    label: 'databasePage',
    icon: '🗄',
    markdown: null,
    kind: 'databasePage',
    blockType: 'database',
    keywords: [
      'full page database',
      'database page',
      'whole page database',
      'database',
      'database as page',
      'full-page database',
    ],
  },
  {
    id: 'chart-horizontal',
    label: 'chartHorizontal',
    icon: '▥',
    markdown: null,
    kind: 'chart',
    chartType: 'chart_horizontal',
    blockType: 'database',
    keywords: [
      'horizontal chart',
      'bar chart',
      'chart horizontal',
      'chart',
      'bar graph',
      'chart bar',
    ],
  },
  {
    id: 'chart-vertical',
    label: 'chartVertical',
    icon: '▤',
    markdown: null,
    kind: 'chart',
    chartType: 'chart_vertical',
    blockType: 'database',
    keywords: [
      'vertical chart',
      'column chart',
      'chart vertical',
      'chart',
      'column graph',
      'chart column',
    ],
  },
  {
    id: 'chart-donut',
    label: 'chartDonut',
    icon: '◔',
    markdown: null,
    kind: 'chart',
    chartType: 'chart_donut',
    blockType: 'database',
    keywords: ['donut chart', 'pie chart', 'chart donut', 'chart', 'ring chart', 'pie graph'],
  },
  {
    id: 'chart-line',
    label: 'chartLine',
    icon: '📈',
    markdown: null,
    kind: 'chart',
    chartType: 'chart_line',
    blockType: 'database',
    keywords: ['line chart', 'chart line', 'chart', 'line graph', 'graph over time'],
  },
  {
    id: 'chart-number',
    label: 'chartNumber',
    icon: '#',
    markdown: null,
    kind: 'chart',
    chartType: 'chart_number',
    blockType: 'database',
    keywords: ['number chart', 'count chart', 'chart number', 'chart', 'number card', 'counter'],
  },
];

export interface SlashRange {
  /** Position of the slash in the document. */
  from: number;
  /** Cursor position in the document. */
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
 * Filters commands by the text after `/`.
 *
 * Exact matches (`/h2`) come first, then prefix matches
 * (`/head`), then matches inside the label or a synonym.
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
