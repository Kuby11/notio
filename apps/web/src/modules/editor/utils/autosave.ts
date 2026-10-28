/**
 * Domain rules of document autosave.
 *
 * Pure functions without React, Tiptap or network: they compare the saved
 * blocks with the current document and compute moves. Debounce and port calls
 * live in the `use-editor` facade hook.
 */
import type { Block, BlockContent, InlineSegment, MathSegment, RichText } from '@notio/contracts';
import type { EditorBlockContent } from './block';

/** Pause between the last document change and the send: 1000 ms. */
export const AUTOSAVE_DELAY_MS = 1000;

/** Key of a new block without an id: links creation to the final order. */
const NEW_BLOCK_KEY_PREFIX = 'new-block:';

export interface AutosavePlan {
  /** Blocks that no longer exist in the document. */
  deletes: string[];
  /** Blocks whose content changed. */
  updates: { id: string; content: BlockContent }[];
  /** New blocks in document order; clientId is the editor node id. */
  creates: { clientId: string; content: BlockContent }[];
  /** Final order: ids of the saved blocks and clientIds of the new ones. */
  order: string[];
}

export interface BlockMove {
  id: string;
  /** The neighbour above in the final document. */
  afterBlockId: string;
}

/**
 * Stable JSON serialisation: object key order must not affect
 * the content comparison between what came from the database and the editor.
 */
function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).toSorted(([left], [right]) => left.localeCompare(right));

    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }

  return JSON.stringify(value) ?? 'null';
}

/**
 * Compares block content regardless of key order and text shape: a
 * legacy string is equivalent to segments without marks, otherwise the first
 * autosave after the rich-text migration would rewrite every block.
 */
export function contentEquals(left: BlockContent, right: BlockContent): boolean {
  return stableJson(normalizeBlockContent(left)) === stableJson(normalizeBlockContent(right));
}

/** Rich text into canonical segments: a string → one segment without marks. */
function asSegments(content: RichText): (InlineSegment | MathSegment)[] {
  return typeof content === 'string' ? [{ text: content }] : content;
}

/** Canonical BlockContent form: rich text as segments, recursively. */
function normalizeBlockContent(content: BlockContent): unknown {
  if (content.type === 'code') {
    return content;
  }

  if (content.type === 'toggle') {
    return {
      ...content,
      content: asSegments(content.content),
      children: content.children?.map(normalizeBlockContent),
    };
  }

  if (content.type === 'columns') {
    return {
      ...content,
      columns: content.columns.map((column) => ({
        ...column,
        children: column.children?.map(normalizeBlockContent),
      })),
    };
  }

  if (content.type === 'table') {
    return {
      ...content,
      rows: content.rows.map((row) => row.map(asSegments)),
    };
  }

  if ('content' in content) {
    return { ...content, content: asSegments(content.content) };
  }

  return content;
}

/**
 * Compares the saved blocks with the current document.
 *
 * New block positions are assigned by the service, so the plan carries no
 * `afterBlockId`: the order is restored by separate moves after creation.
 */
export function planAutosave(
  saved: readonly Block[],
  next: readonly EditorBlockContent[],
): AutosavePlan {
  const savedById = new Map(saved.map((block) => [block.id, block]));
  const keptIds = new Set<string>();
  const updates: AutosavePlan['updates'] = [];
  const creates: AutosavePlan['creates'] = [];
  const order: string[] = [];

  next.forEach((entry, index) => {
    const savedBlock = entry.id === null ? undefined : savedById.get(entry.id);

    if (entry.id !== null && savedBlock !== undefined && !keptIds.has(entry.id)) {
      keptIds.add(entry.id);

      if (!contentEquals(savedBlock.content, entry.content)) {
        updates.push({ id: entry.id, content: entry.content });
      }

      order.push(entry.id);
      return;
    }

    // New block: the editor node gets a temporary id until the service answers.
    // A repeated saved id (for example splitting a block before its id was assigned)
    // must not be sent as a creation with the same key.
    const clientId =
      entry.id !== null && !keptIds.has(entry.id) ? entry.id : `${NEW_BLOCK_KEY_PREFIX}${index}`;

    creates.push({ clientId, content: entry.content });
    order.push(clientId);
  });

  const deletes = saved.map((block) => block.id).filter((id) => !keptIds.has(id));

  return { deletes, updates, creates, order };
}

/**
 * Computes the moves that bring the current order to the final one.
 *
 * The first block never moves: the move API only inserts a block after
 * a neighbour, so "put it first" is possible only by moving the other
 * blocks behind it.
 */
export function planMoves(
  finalOrder: readonly string[],
  currentOrder: readonly string[],
): BlockMove[] {
  const order = [...currentOrder];
  const moves: BlockMove[] = [];

  for (let index = 1; index < finalOrder.length; index += 1) {
    const id = finalOrder[index];
    const previous = finalOrder[index - 1];

    if (id === undefined || previous === undefined) {
      continue;
    }

    const position = order.indexOf(id);
    const previousPosition = order.indexOf(previous);

    if (position === -1 || previousPosition === -1 || position > previousPosition) {
      continue;
    }

    moves.push({ id, afterBlockId: previous });

    order.splice(position, 1);
    order.splice(order.indexOf(previous) + 1, 0, id);
  }

  return moves;
}
