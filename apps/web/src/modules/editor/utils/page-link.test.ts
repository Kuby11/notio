import type { Page } from '@notio/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  collectWorkspacePages,
  pageBreadcrumbChain,
  pageLinkBridge,
  setPageLinkBridge,
  type PagesPortLike,
} from './page-link';

function page(id: string, parentId: string | null, hasChildren = false): Page {
  return {
    id,
    workspaceId: 'ws-1',
    parentId,
    title: id,
    icon: null,
    coverFileId: null,
    position: 'a0',
    isFavorite: false,
    isTrashed: false,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    hasChildren,
  } as unknown as Page;
}

function fakePort(pages: Page[]): PagesPortLike {
  const byId = new Map(pages.map((item) => [item.id, item]));

  return {
    getPage: async (pageId) => {
      const found = byId.get(pageId);

      if (!found) {
        throw new Error(`unknown page ${pageId}`);
      }

      return found;
    },
    listChildren: async (_workspaceId, parentId) =>
      pages.filter((item) => item.parentId === parentId),
  };
}

describe('page link bridge', () => {
  it('falls back to an empty bridge that throws on page lookups', async () => {
    const editor = {};
    const bridge = pageLinkBridge(editor);

    expect(bridge.workspaceId).toBe('');
    expect(bridge.currentPageId).toBe('');
    await expect(bridge.getPage('page-1')).rejects.toThrow(/Page bridge/);
    await expect(bridge.listPages()).resolves.toEqual([]);
    expect(() => bridge.navigate('/workspaces/ws-1/page-1')).not.toThrow();
  });

  it('returns the assigned bridge per editor instance', () => {
    const first = {};
    const second = {};
    const navigate = vi.fn<(path: string) => void>();
    const bridge = {
      workspaceId: 'ws-1',
      currentPageId: 'page-1',
      getPage: async () => page('page-1', null),
      listPages: async () => [],
      navigate,
    };

    setPageLinkBridge(first, bridge);

    expect(pageLinkBridge(first)).toBe(bridge);
    expect(pageLinkBridge(second).workspaceId).toBe('');

    pageLinkBridge(first).navigate('/x');
    expect(navigate).toHaveBeenCalledWith('/x');
  });
});

describe('collectWorkspacePages', () => {
  it('walks roots and children in tree order', async () => {
    const pages = [
      page('root-1', null, true),
      page('child-1', 'root-1', true),
      page('grandchild', 'child-1'),
      page('root-2', null),
    ];

    await expect(collectWorkspacePages(fakePort(pages), 'ws-1')).resolves.toEqual([
      pages[0],
      pages[1],
      pages[2],
      pages[3],
    ]);
  });

  it('stops at the depth limit', async () => {
    const pages = Array.from({ length: 7 }, (_, index) =>
      page(`p${index}`, index === 0 ? null : `p${index - 1}`, index < 6),
    );

    const collected = await collectWorkspacePages(fakePort(pages), 'ws-1');

    expect(collected.map((item) => item.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4']);
  });

  it('returns an empty list for an empty workspace', async () => {
    await expect(
      collectWorkspacePages(
        { getPage: async () => page('x', null), listChildren: async () => [] },
        'ws-1',
      ),
    ).resolves.toEqual([]);
  });
});

describe('pageBreadcrumbChain', () => {
  it('returns the ancestors from the root to the page itself', async () => {
    const pages = [page('root', null), page('child', 'root'), page('leaf', 'child')];

    const chain = await pageBreadcrumbChain(fakePort(pages), 'ws-1', 'leaf');

    expect(chain.map((item) => item.id)).toEqual(['root', 'child', 'leaf']);
  });

  it('returns a single page for a root', async () => {
    const chain = await pageBreadcrumbChain(fakePort([page('root', null)]), 'ws-1', 'root');

    expect(chain.map((item) => item.id)).toEqual(['root']);
  });

  it('stops on a cyclic parent chain', async () => {
    const cyclic = page('loop', 'loop');

    const chain = await pageBreadcrumbChain(fakePort([cyclic]), 'ws-1', 'loop');

    expect(chain.length).toBe(21);
  });
});
