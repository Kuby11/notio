import type { Page } from '@notio/contracts';
import type { Editor } from '@tiptap/react';

/**
 * Bridge to the React layer for blocks that need page data (page link,
 * breadcrumbs). Extensions and node views know nothing about the network
 * or the router: ReactRenderer renders node views outside the app tree,
 * so context and hooks do not reach them. As with the sub-page bridge, the
 * bridge lives in a WeakMap keyed by editor instance.
 *
 * Ports arrive as structural types: the pages port comes from the container
 * in ui/public/editor.tsx; here it is only called.
 */
export interface PagesPortLike {
  getPage(pageId: string, workspaceId: string): Promise<Page>;
  listChildren(
    workspaceId: string,
    parentId: string | null,
    includeTrashed: boolean,
  ): Promise<Page[]>;
}

export interface PageLinkBridge {
  /** Active workspace: routes and page queries. */
  workspaceId: string;
  /** The page being edited: the start of the breadcrumbs. */
  currentPageId: string;
  /** Page data (title, icon) for the link and breadcrumbs. */
  getPage: (pageId: string) => Promise<Page>;
  /** Flat list of workspace pages for the picker dialog. */
  listPages: () => Promise<Page[]>;
  /** Navigation (router.push from the React layer). */
  navigate: (href: string) => void;
}

const NOOP_BRIDGE: PageLinkBridge = {
  workspaceId: '',
  currentPageId: '',
  getPage: async () => {
    throw new Error('Page bridge is not assigned to the editor');
  },
  listPages: async () => [],
  navigate: () => undefined,
};

const bridges = new WeakMap<object, PageLinkBridge>();

/** Assigns the bridge to an editor instance, once per instance from ui/public/editor.tsx. */
export function setPageLinkBridge(editor: object, bridge: PageLinkBridge): void {
  bridges.set(editor, bridge);
}

export function pageLinkBridge(editor: object): PageLinkBridge {
  return bridges.get(editor) ?? NOOP_BRIDGE;
}

/** Depth limit for walking the page tree in the picker dialog. */
const LIST_PAGES_MAX_DEPTH = 4;

/** Flat list of workspace pages: roots, then children down to depth 4. */
export async function collectWorkspacePages(
  pages: PagesPortLike,
  workspaceId: string,
): Promise<Page[]> {
  const result: Page[] = [];

  const walk = async (parentId: string | null, depth: number): Promise<void> => {
    if (depth > LIST_PAGES_MAX_DEPTH) {
      return;
    }

    const children = await pages.listChildren(workspaceId, parentId, false);

    for (const page of children) {
      result.push(page);

      if (page.hasChildren === true) {
        await walk(page.id, depth + 1);
      }
    }
  };

  await walk(null, 0);

  return result;
}

/** Ancestor chain of a page: [root, …, parent] without the page itself. */
export async function pageBreadcrumbChain(
  pages: PagesPortLike,
  workspaceId: string,
  pageId: string,
): Promise<Page[]> {
  const chain: Page[] = [];
  let current = await pages.getPage(pageId, workspaceId);
  chain.unshift(current);

  for (let guard = 0; current.parentId && guard < 20; guard += 1) {
    current = await pages.getPage(current.parentId, workspaceId);
    chain.unshift(current);
  }

  return chain;
}

/** Editor type for the bridges: used only as a WeakMap key. */
export type PageLinkEditor = Editor;
