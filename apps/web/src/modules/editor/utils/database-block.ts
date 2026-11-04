import { newId, type DatabaseViewType } from '@notio/contracts';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { insertAtomicAtSlash, insertAtomicBelow } from './atomic-block';
import type { EditorBlockLocation } from './block-insert';
import type { SlashRange } from './slash';

/**
 * Insertion of database blocks.
 *
 * Inline database: the node appears at once without a databaseId, the editor
 * layer creates the database and the id lands in attrs after the response.
 * A node without an id is not serialised (see nodeToContent), so autosave
 * cannot store a block pointing at nothing.
 *
 * Full-page database: the same handshake, but the node is a `databaseLink`
 * chip. Once the row exists the editor navigates to the database page; the
 * navigation is deferred until autosave stores the chip (see ui/public/editor).
 */

/** Which database the block represents. */
export type DatabaseBlockKind = 'inline' | 'page';

/** The database created for the block: the id is all the node needs. */
export interface DatabaseDraft {
  id: string;
  title: string;
  /** The view a chart block should open first. */
  viewId?: string;
}

/** Bridge to the React layer: the extension knows nothing about the network. */
export interface DatabaseBlockBridge {
  /** Active workspace: the whole-page link points at its database route. */
  workspaceId: string;
  /** Creates the database row; null — failed, the error is shown by the bridge. */
  createDatabase: (
    kind: DatabaseBlockKind,
    chartType?: DatabaseViewType,
  ) => Promise<DatabaseDraft | null>;
  /** Title for the link chip: the page keeps its name after renaming. */
  getDatabase: (id: string) => Promise<DatabaseDraft | null>;
  /** Opens the database page (used by the chip). */
  openDatabase: (id: string) => void;
  /** Opens the page created from the slash command after the link is saved. */
  openCreatedDatabase: (id: string) => void;
}

const NOOP_BRIDGE: DatabaseBlockBridge = {
  workspaceId: '',
  createDatabase: async () => null,
  getDatabase: async () => null,
  openDatabase: () => undefined,
  openCreatedDatabase: () => undefined,
};

const bridges = new WeakMap<object, DatabaseBlockBridge>();

/** Assigns the bridge to an editor instance, once per instance from ui/public/editor.tsx. */
export function setDatabaseBlockBridge(editor: object, bridge: DatabaseBlockBridge): void {
  bridges.set(editor, bridge);
}

export function databaseBlockBridge(editor: object): DatabaseBlockBridge {
  return bridges.get(editor) ?? NOOP_BRIDGE;
}

const DATABASE_NODE_TYPES = new Set(['databaseBlock', 'databaseLink']);

function createDatabaseNode(editor: Editor, kind: DatabaseBlockKind): ProseMirrorNode | null {
  const name = kind === 'page' ? 'databaseLink' : 'databaseBlock';
  const type = editor.state.schema.nodes[name];

  // The blockId finds the node again after the asynchronous service response.
  return type?.create({ blockId: newId(), databaseId: '' }) ?? null;
}

/** Inserts an inline database instead of `/database` in the current block. */
export async function insertDatabaseAtSlash(
  editor: Editor,
  range: SlashRange,
  chartType?: DatabaseViewType,
): Promise<boolean> {
  const node = createDatabaseNode(editor, 'inline');

  if (!node || !insertAtomicAtSlash(editor, range, node)) {
    return false;
  }

  return linkCreatedDatabase(editor, blockIdOf(node), 'inline', chartType);
}

/** Inserts a whole-page database link instead of `/database page`. */
export async function insertDatabasePageAtSlash(
  editor: Editor,
  range: SlashRange,
): Promise<boolean> {
  const node = createDatabaseNode(editor, 'page');

  if (!node || !insertAtomicAtSlash(editor, range, node)) {
    return false;
  }

  return linkCreatedDatabase(editor, blockIdOf(node), 'page');
}

/** Inserts an inline database below the block the plus menu is open over. */
export async function insertDatabaseBelow(
  editor: Editor,
  source: EditorBlockLocation,
  chartType?: DatabaseViewType,
): Promise<boolean> {
  const node = createDatabaseNode(editor, 'inline');

  if (!node || !insertAtomicBelow(editor, source, node)) {
    return false;
  }

  return linkCreatedDatabase(editor, blockIdOf(node), 'inline', chartType);
}

/** Inserts a whole-page database link below the block the plus menu is open over. */
export async function insertDatabasePageBelow(
  editor: Editor,
  source: EditorBlockLocation,
): Promise<boolean> {
  const node = createDatabaseNode(editor, 'page');

  if (!node || !insertAtomicBelow(editor, source, node)) {
    return false;
  }

  return linkCreatedDatabase(editor, blockIdOf(node), 'page');
}

function blockIdOf(node: ProseMirrorNode): string {
  const blockId = node.attrs['blockId'];

  return typeof blockId === 'string' ? blockId : '';
}

interface NodePosition {
  pos: number;
  node: ProseMirrorNode;
}

function findDatabaseByBlockId(editor: Editor, blockId: string): NodePosition | null {
  let found: NodePosition | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (found !== null || !DATABASE_NODE_TYPES.has(node.type.name)) {
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
 * Waits for the database row and links the node to it.
 *
 * If creation fails the placeholder is replaced by an empty paragraph; the
 * user may have deleted the node while the request ran — then nothing is
 * touched. For a whole-page database the editor navigates only after the
 * chip has been saved (the React layer decides when).
 */
async function linkCreatedDatabase(
  editor: Editor,
  blockId: string,
  kind: DatabaseBlockKind,
  chartType?: DatabaseViewType,
): Promise<boolean> {
  const draft = await databaseBlockBridge(editor).createDatabase(kind, chartType);

  if (editor.isDestroyed) {
    return draft !== null;
  }

  const found = blockId.length > 0 ? findDatabaseByBlockId(editor, blockId) : null;

  if (!found) {
    return draft !== null;
  }

  if (draft) {
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(found.pos, undefined, {
        ...found.node.attrs,
        databaseId: draft.id,
        ...(draft.viewId ? { viewId: draft.viewId } : {}),
      }),
    );

    if (kind === 'page') {
      databaseBlockBridge(editor).openCreatedDatabase(draft.id);
    }

    return true;
  }

  const paragraph = editor.state.schema.nodes['paragraph'];

  if (!paragraph) {
    return false;
  }

  const next = editor.state.doc.resolve(found.pos + found.node.nodeSize).nodeAfter;
  const nextIsEmptyParagraph = next?.type.name === 'paragraph' && next.textContent.length === 0;
  const transaction = nextIsEmptyParagraph
    ? editor.state.tr.delete(found.pos, found.pos + found.node.nodeSize)
    : editor.state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, paragraph.create());

  transaction.setSelection(TextSelection.near(transaction.doc.resolve(found.pos)));
  editor.view.dispatch(transaction.scrollIntoView());

  return false;
}
