import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { BlockColorPresetSchema, type BlockColorPreset } from '@notio/contracts';
import { firstTextblockPosition, type EditorBlockLocation } from './block-insert';
import { mediaBridge } from './media-bridge';
import { applySlashCommand } from './slash-command';
import type { SlashCommandKind } from './slash';

/**
 * Block menu actions on the drag handle: turn into, colour,
 * duplicate and delete. Pure operations over the editor — the UI lives in
 * ui/private/block-actions-menu.tsx, block data arrives as an
 * EditorBlockLocation from findBlockAtPosition.
 */

/** Turn-into target: kind repeats the slash commands, applying is shared. */
export interface TurnIntoOption {
  id: string;
  label: string;
  icon: string;
  kind: SlashCommandKind;
  headingLevel?: 1 | 2 | 3 | 4;
}

/** Turning changes the type of the row, not the whole document content. */
export const TURN_INTO_OPTIONS: readonly TurnIntoOption[] = [
  { id: 'text', label: 'Text', icon: '¶', kind: 'paragraph' },
  { id: 'heading1', label: 'Heading 1', icon: 'H1', kind: 'heading', headingLevel: 1 },
  { id: 'heading2', label: 'Heading 2', icon: 'H2', kind: 'heading', headingLevel: 2 },
  { id: 'heading3', label: 'Heading 3', icon: 'H3', kind: 'heading', headingLevel: 3 },
  { id: 'heading4', label: 'Heading 4', icon: 'H4', kind: 'heading', headingLevel: 4 },
  { id: 'toDo', label: 'To-do list', icon: '☑', kind: 'toDo' },
  { id: 'bulletedList', label: 'Bulleted list', icon: '•', kind: 'bulletList' },
  { id: 'numberedList', label: 'Numbered list', icon: '1.', kind: 'orderedList' },
  { id: 'toggle', label: 'Toggle list', icon: '▸', kind: 'toggle' },
  { id: 'quote', label: 'Quote', icon: '❝', kind: 'quote' },
  { id: 'code', label: 'Code', icon: '</>', kind: 'code' },
];

/** Types that can be turned into another row type. */
const TURNABLE_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'details',
  'image',
]);

/** Types whose colour serialises into content (a code block has no colour fields). */
const COLORABLE_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'listItem',
  'taskItem',
  'details',
  'table',
]);

export function canTurnInto(node: ProseMirrorNode): boolean {
  return TURNABLE_TYPES.has(node.type.name);
}

/** Turn-into targets depend on the block: an image offers only the file. */
export function turnIntoOptionsFor(node: ProseMirrorNode): readonly TurnIntoOption[] {
  if (node.type.name === 'image') {
    return [{ id: 'file', label: 'File', icon: '📎', kind: 'file' }];
  }

  return TURN_INTO_OPTIONS;
}

/** The block has a source for download/replace (fileId or link). */
export function mediaSourceOfNode(
  node: ProseMirrorNode,
): { fileId: string | null; url: string | null } | null {
  const fileId = node.attrs['fileId'];
  const url = node.attrs['url'];

  if (typeof fileId === 'string' && fileId.length > 0) {
    return { fileId, url: null };
  }

  if (typeof url === 'string' && url.length > 0) {
    return { fileId: null, url };
  }

  return null;
}

/** Download/replace are available to blocks with a source (image/video/file). */
export function canUseMediaActions(node: ProseMirrorNode): boolean {
  return ['image', 'video', 'file'].includes(node.type.name) && mediaSourceOfNode(node) !== null;
}

/**
 * Downloads the block's file: an anchor button with ?download=1 for R2 files,
 * a direct link for external URLs.
 */
export function downloadBlockFile(editor: Editor, location: EditorBlockLocation): void {
  const source = mediaSourceOfNode(location.node);

  if (!source) {
    return;
  }

  const href =
    source.fileId !== null ? mediaBridge(editor).fileUrl(source.fileId, true) : source.url;

  if (typeof href !== 'string' || href.length === 0) {
    return;
  }

  const anchor = document.createElement('a');

  anchor.href = href;
  anchor.download = '';
  anchor.rel = 'noopener noreferrer';
  anchor.click();
}

/**
 * Source replacement: sets the service attr replacing — the block's node view
 * shows the "file or link" card instead of the current content, while the
 * original attrs stay (cancelling brings the image back).
 */
export function startReplaceSource(editor: Editor, location: EditorBlockLocation): void {
  const { node, pos } = location;

  if (node.type.name !== 'image') {
    return;
  }

  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, replacing: true }),
  );
}

export function canColorBlock(node: ProseMirrorNode): boolean {
  return COLORABLE_TYPES.has(node.type.name);
}

/** Preset from the node's attrs, or null when the value is missing or unknown. */
function presetOrNull(value: unknown): BlockColorPreset | null {
  const result = BlockColorPresetSchema.safeParse(value);

  return result.success ? result.data : null;
}

/** Current text colour of the block or null. */
export function blockColorOf(node: ProseMirrorNode): BlockColorPreset | null {
  return presetOrNull(node.attrs['color']);
}

/** Current background colour of the block or null. */
export function blockBackgroundOf(node: ProseMirrorNode): BlockColorPreset | null {
  return presetOrNull(node.attrs['backgroundColor']);
}

/**
 * Id of the current block type in TURN_INTO_OPTIONS or null.
 *
 * A list element counts as a list itself: it has no "text" view of its own,
 * and turning it into text means leaving the list.
 */
export function currentTurnIntoOptionId(location: EditorBlockLocation): string | null {
  const { node, parent } = location;

  switch (node.type.name) {
    case 'paragraph':
      return parent.type.name === 'doc' || parent.type.name === 'detailsContent' ? 'text' : null;
    case 'heading': {
      const level = node.attrs['level'];
      const safeLevel = level === 2 || level === 3 || level === 4 ? level : 1;

      return `heading${safeLevel}`;
    }
    case 'blockquote':
      return 'quote';
    case 'codeBlock':
      return 'code';
    case 'details':
      return 'toggle';
    case 'listItem':
    case 'taskItem':
      switch (parent.type.name) {
        case 'bulletList':
          return 'bulletedList';
        case 'orderedList':
          return 'numberedList';
        case 'taskList':
          return 'toDo';
        default:
          return null;
      }
    default:
      return null;
  }
}

/** The block already has the selected type — no turning needed. */
function isAlreadyKind(location: EditorBlockLocation, option: TurnIntoOption): boolean {
  return currentTurnIntoOptionId(location) === option.id;
}

/**
 * Turns a block into another row type, keeping its text.
 *
 * Containers are unfolded first: a toggle into a heading paragraph plus its
 * child blocks (otherwise the children would be silently lost), a code block
 * into a paragraph (otherwise quoting would swallow the text — blockText only
 * reads paragraphs). Then a regular slash command with an empty range applies.
 */
export function turnIntoBlock(
  editor: Editor,
  location: EditorBlockLocation,
  option: TurnIntoOption,
): boolean {
  const { node, pos } = location;

  if (!canTurnInto(node) || isAlreadyKind(location, option)) {
    return canTurnInto(node);
  }

  // An image turns into a file directly: the source moves over,
  // an image has no file name — take the caption or "Image".
  if (node.type.name === 'image') {
    if (option.kind !== 'file') {
      return true;
    }

    const source = mediaSourceOfNode(node);
    const fileNode = editor.state.schema.nodes['file'];

    if (!source || !fileNode) {
      return false;
    }

    const caption = node.attrs['caption'];
    const transaction = editor.state.tr.replaceWith(
      pos,
      pos + node.nodeSize,
      fileNode.create({
        ...node.attrs,
        fileId: source.fileId,
        url: source.url,
        name: typeof caption === 'string' && caption.length > 0 ? caption : 'Image',
        sizeBytes: null,
      }),
    );

    editor.view.dispatch(transaction);

    return true;
  }

  if (node.type.name === 'details' && option.kind !== 'toggle') {
    if (!unwrapDetails(editor, location)) {
      return false;
    }
  }

  const current = editor.state.doc.nodeAt(pos);

  if (!current) {
    return false;
  }

  const textblockPosition = firstTextblockPosition(current, pos);

  if (textblockPosition === null) {
    return false;
  }

  editor.commands.setTextSelection(textblockPosition);

  // Out of a code block into non-code: first a regular paragraph with the same text.
  if (current.type.name === 'codeBlock' && option.kind !== 'code') {
    editor.commands.setParagraph();
  }

  applySlashCommand(editor, option, { from: textblockPosition, to: textblockPosition });

  return true;
}

/** Unfolds a toggle: the title becomes a paragraph, children become blocks below. */
function unwrapDetails(editor: Editor, location: EditorBlockLocation): boolean {
  const { node, pos } = location;
  const paragraph = editor.state.schema.nodes['paragraph'];

  if (node.type.name !== 'details' || !paragraph) {
    return false;
  }

  let headerText = '';
  const children: ProseMirrorNode[] = [];

  node.forEach((child) => {
    if (child.type.name === 'detailsSummary') {
      headerText = child.textContent;
    }

    if (child.type.name === 'detailsContent') {
      child.forEach((grandChild) => {
        children.push(grandChild);
      });
    }
  });

  // A trailing empty paragraph is a service stub for an empty body, not content.
  const last = children.at(-1);

  if (last?.type.name === 'paragraph' && last.textContent.length === 0) {
    children.pop();
  }

  const replacement = [
    paragraph.create(
      null,
      headerText.length > 0 ? editor.state.schema.text(headerText) : undefined,
    ),
    ...children,
  ];

  const transaction = editor.state.tr.replaceWith(pos, pos + node.nodeSize, replacement);

  editor.view.dispatch(transaction);

  return true;
}

/**
 * Deletes a block. If it was the only one, the document gets an empty
 * paragraph: an empty document is invalid in ProseMirror's schema.
 */
export function deleteBlockAt(editor: Editor, location: EditorBlockLocation): void {
  const { node, pos } = location;
  const paragraph = editor.state.schema.nodes['paragraph'];
  const transaction = editor.state.tr;

  if (editor.state.doc.content.size === node.nodeSize && paragraph) {
    transaction.replaceWith(pos, pos + node.nodeSize, paragraph.create());
  } else {
    transaction.delete(pos, pos + node.nodeSize);
  }

  transaction.setSelection(
    TextSelection.near(transaction.doc.resolve(Math.min(pos, transaction.doc.content.size))),
  );
  editor.view.dispatch(transaction.scrollIntoView());
}

/**
 * Duplicates a block right under the original.
 *
 * The copy arrives with the same blockId: BlockIdGuard sees the repeat and gives
 * the new node its own id, so autosave creates a separate row.
 */
export function duplicateBlockAt(editor: Editor, location: EditorBlockLocation): void {
  const { node, pos } = location;
  // copy() with no arguments creates an empty node — pass the content explicitly.
  const transaction = editor.state.tr.insert(pos + node.nodeSize, node.copy(node.content));
  const copyPosition = pos + node.nodeSize;
  const textblockPosition = firstTextblockPosition(node, copyPosition);

  if (textblockPosition !== null) {
    transaction.setSelection(TextSelection.near(transaction.doc.resolve(textblockPosition)));
  }

  editor.view.dispatch(transaction.scrollIntoView());
}

/** Block colour change: null resets the colour to its default. */
export function setBlockColors(
  editor: Editor,
  location: EditorBlockLocation,
  colors: { color?: BlockColorPreset | null; backgroundColor?: BlockColorPreset | null },
): void {
  const { node, pos } = location;
  const attrs = { ...node.attrs };

  if (colors.color !== undefined) {
    if (colors.color === null) {
      delete attrs['color'];
    } else {
      attrs['color'] = colors.color;
    }
  }

  if (colors.backgroundColor !== undefined) {
    if (colors.backgroundColor === null) {
      delete attrs['backgroundColor'];
    } else {
      attrs['backgroundColor'] = colors.backgroundColor;
    }
  }

  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, attrs));
}
