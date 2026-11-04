import { newId } from '@notio/contracts';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { insertAtomicAtSlash, insertAtomicBelow } from './atomic-block';
import type { EditorBlockLocation } from './block-insert';
import type { SlashRange } from './slash';

/**
 * Sub-page block insertion: an optimistic node without a pageId, then page
 * creation by the service and an attrs update. Pure editor operations —
 * network and navigation arrive through the bridge from ui/public/editor.tsx.
 */

/** Child page created by the service: id and display data. */
export interface SubPageDraft {
  id: string;
  title: string;
  icon: string | null;
}

/**
 * Bridge to the React layer: extensions know nothing about the network or router.
 *
 * It lives in a WeakMap keyed by editor instance: Tiptap types `editor.storage`
 * as the DOM Storage interface without an index signature, so the bridge
 * cannot live in storage without an `as` cast. The WeakMap dies with the editor.
 */
export interface SubPageBridge {
  /** Creates a child page for the current one; null means creation failed. */
  createSubPage: () => Promise<SubPageDraft | null>;
  /** Opens the page (navigates to its route). */
  openSubPage: (pageId: string) => void;
}

const NOOP_BRIDGE: SubPageBridge = {
  createSubPage: async () => null,
  openSubPage: () => undefined,
};

const bridges = new WeakMap<object, SubPageBridge>();

/** Assigns the bridge to an editor instance, once per instance from ui/public/editor.tsx. */
export function setSubPageBridge(editor: object, bridge: SubPageBridge): void {
  bridges.set(editor, bridge);
}

export function subPageBridge(editor: object): SubPageBridge {
  return bridges.get(editor) ?? NOOP_BRIDGE;
}

function createSubPageNode(editor: Editor): ProseMirrorNode | null {
  const type = editor.state.schema.nodes['subPage'];

  // A dedicated blockId lets us find the node after the asynchronous service response.
  return type?.create({ blockId: newId() }) ?? null;
}

/**
 * Inserts a sub-page instead of `/page` in the current block.
 *
 * An empty paragraph is replaced by the link node; a non-empty one gets it below.
 * The command leaves a list the same way a heading or toggle does: otherwise the
 * atomic node would sit inside listItem and be lost during serialisation.
 */
export async function insertSubPageAtSlash(editor: Editor, range: SlashRange): Promise<boolean> {
  const node = createSubPageNode(editor);

  if (!node || !insertAtomicAtSlash(editor, range, node)) {
    return false;
  }

  return linkCreatedPage(editor, blockIdOf(node));
}

/** Inserts a sub-page below the block from the plus menu. */
export async function insertSubPageBelow(
  editor: Editor,
  source: EditorBlockLocation,
): Promise<boolean> {
  const node = createSubPageNode(editor);

  if (!node || !insertAtomicBelow(editor, source, node)) {
    return false;
  }

  return linkCreatedPage(editor, blockIdOf(node));
}

function blockIdOf(node: ProseMirrorNode): string {
  const blockId = node.attrs['blockId'];

  return typeof blockId === 'string' ? blockId : '';
}

interface NodePosition {
  pos: number;
  node: ProseMirrorNode;
}

function findSubPageByBlockId(editor: Editor, blockId: string): NodePosition | null {
  let found: NodePosition | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (found !== null || node.type.name !== 'subPage') {
      return !found;
    }

    if (blockIdOf(node) === blockId) {
      found = { pos, node };
      return false;
    }

    return true;
  });

  return found;
}

/**
 * Waits for page creation and links the node to it.
 *
 * A node with an empty pageId is not saved, so there is no race with autosave:
 * the block reaches the DB only after the service responds. If the page cannot
 * be created, the placeholder becomes an empty paragraph. The user may have
 * deleted the node during the request, in which case nothing is touched.
 */
async function linkCreatedPage(editor: Editor, blockId: string): Promise<boolean> {
  const draft = await subPageBridge(editor).createSubPage();

  if (editor.isDestroyed) {
    return draft !== null;
  }

  const found = blockId.length > 0 ? findSubPageByBlockId(editor, blockId) : null;

  if (!found) {
    return draft !== null;
  }

  if (draft) {
    const transaction = editor.state.tr.setNodeMarkup(found.pos, undefined, {
      ...found.node.attrs,
      pageId: draft.id,
      title: draft.title,
      icon: draft.icon,
    });

    editor.view.dispatch(transaction);
    return true;
  }

  const paragraph = editor.state.schema.nodes['paragraph'];

  if (!paragraph) {
    return false;
  }

  // If an empty paragraph already follows (insertion added it for typing
  // text), we simply delete the placeholder: the document is back to one block.
  const next = editor.state.doc.resolve(found.pos + found.node.nodeSize).nodeAfter;
  const nextIsEmptyParagraph = next?.type.name === 'paragraph' && next.textContent.length === 0;
  const transaction = nextIsEmptyParagraph
    ? editor.state.tr.delete(found.pos, found.pos + found.node.nodeSize)
    : editor.state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, paragraph.create());

  transaction.setSelection(TextSelection.near(transaction.doc.resolve(found.pos)));
  editor.view.dispatch(transaction.scrollIntoView());

  return false;
}
