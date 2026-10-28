/**
 * Markdown import into contract blocks.
 *
 * A pure function without React or network: parses text into BlockContent[],
 * like Notion's .md import. Supported: headings, lists (including
 * checkboxes), quotes, dividers, code fences and paragraphs; everything
 * else becomes text.
 */
import type { BlockContent } from '@notio/contracts';

const CODE_FENCE_PATTERN = /^```([a-zA-Z0-9_-]*)\s*$/;
const HEADING_PATTERN = /^(#{1,4})\s+(.*)$/;
const DIVIDER_PATTERN = /^(-{3,}|\*{3,})$/;
const TODO_PATTERN = /^[-*]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_PATTERN = /^[-*]\s+(.*)$/;
const NUMBERED_PATTERN = /^\d+[.)]\s+(.*)$/;
const QUOTE_PATTERN = /^>\s?(.*)$/;

/** Разбирает Markdown-текст в блоки для создания страницы. */
export function parseMarkdownToBlocks(markdown: string): BlockContent[] {
  const blocks: BlockContent[] = [];
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const paragraphBuffer: string[] = [];

  const flushParagraph = (): void => {
    if (paragraphBuffer.length > 0) {
      blocks.push({ type: 'paragraph', content: paragraphBuffer.join(' ') });
      paragraphBuffer.length = 0;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim();

    if (line.length === 0) {
      flushParagraph();
      continue;
    }

    const fence = CODE_FENCE_PATTERN.exec(line);

    if (fence) {
      flushParagraph();
      const language = fence[1] && fence[1].length > 0 ? fence[1].toLowerCase() : null;
      const codeLines: string[] = [];

      for (index += 1; index < lines.length && (lines[index] ?? '').trim() !== '```'; index += 1) {
        codeLines.push(lines[index] ?? '');
      }

      blocks.push({ type: 'code', language, content: codeLines.join('\n') });
      continue;
    }

    const heading = HEADING_PATTERN.exec(line);

    if (heading) {
      flushParagraph();
      const level = Math.min(4, Math.max(1, heading[1]?.length ?? 1)) as 1 | 2 | 3 | 4;

      blocks.push({ type: 'heading', level, content: heading[2] ?? '' });
      continue;
    }

    if (DIVIDER_PATTERN.test(line)) {
      flushParagraph();
      blocks.push({ type: 'divider' });
      continue;
    }

    const todo = TODO_PATTERN.exec(line);

    if (todo) {
      flushParagraph();
      blocks.push({
        type: 'toDo',
        checked: (todo[1] ?? ' ').toLowerCase() === 'x',
        content: todo[2] ?? '',
      });
      continue;
    }

    const bullet = BULLET_PATTERN.exec(line);

    if (bullet) {
      flushParagraph();
      blocks.push({ type: 'bulletedListItem', content: bullet[1] ?? '' });
      continue;
    }

    const numbered = NUMBERED_PATTERN.exec(line);

    if (numbered) {
      flushParagraph();
      blocks.push({ type: 'numberedListItem', content: numbered[1] ?? '' });
      continue;
    }

    const quote = QUOTE_PATTERN.exec(line);

    if (quote) {
      flushParagraph();
      blocks.push({ type: 'quote', content: quote[1] ?? '' });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();

  return blocks;
}

/** Заголовок импортируемой страницы: первый заголовок или имя файла. */
export function importTitleFrom(
  blocks: readonly BlockContent[],
  filename: string,
  fallbackTitle: string,
): string {
  const heading = blocks.find((block) => block.type === 'heading');

  if (heading && heading.type === 'heading' && heading.content.length > 0) {
    return typeof heading.content === 'string'
      ? heading.content
      : heading.content
          .map((segment) => ('math' in segment ? segment.math : segment.text))
          .join('');
  }

  return filename.replace(/\.(md|markdown|txt)$/iu, '') || fallbackTitle;
}
