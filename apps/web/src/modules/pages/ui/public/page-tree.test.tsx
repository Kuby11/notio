// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@notio/contracts';
import { gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { usePageTreeStore } from '../../stores/page-tree.store';
import { PageTree } from './page-tree';

const routerPush = vi.hoisted(() => vi.fn<(href: string) => void>());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    refresh: vi.fn<() => void>(),
    prefetch: vi.fn<() => void>(),
  }),
  // The open row gets the active pill from the current path.
  usePathname: () => `/workspaces/${WORKSPACE_ID}/${ROOT_ID}`,
}));

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000010';
const ROOT_ID = '00000000-0000-4000-8000-000000000101';
const LEAF_ID = '00000000-0000-4000-8000-000000000102';
const CHILD_ID = '00000000-0000-4000-8000-000000000103';
const NOW = '2026-01-01T00:00:00.000Z';

function page(overrides: Partial<Page> & Pick<Page, 'id' | 'title' | 'position'>): Page {
  return {
    workspaceId: WORKSPACE_ID,
    parentId: null,
    isFavorite: false,
    isTrashed: false,
    createdBy: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const ROOT = page({ id: ROOT_ID, title: 'Root', position: 'a0', hasChildren: true });
const LEAF = page({ id: LEAF_ID, title: 'Leaf', position: 'a1' });
const CHILD = page({ id: CHILD_ID, title: 'Nested', parentId: ROOT_ID, position: 'a0' });
const CREATED_ID = '00000000-0000-4000-8000-000000000104';
const CREATED = page({ id: CREATED_ID, title: '', position: 'a2' });

let fetchCalls = 0;

beforeEach(() => {
  fetchCalls = 0;
  // The expanded set lives in a module-level store: without a reset the
  // previous test's expanded nodes leak into this one.
  usePageTreeStore.getState().reset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls += 1;
      const url = new URL(String(input), 'http://localhost');

      if (init?.method === 'POST') {
        return new Response(JSON.stringify(CREATED), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      const parentId = url.searchParams.get('parentId');
      const items = parentId === ROOT_ID ? [CHILD] : parentId === null ? [ROOT, LEAF] : [];

      return new Response(JSON.stringify({ items, nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PageTree', () => {
  it('navigates to page, nesting expands with separate button', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<PageTree workspaceId={WORKSPACE_ID} />, gateway);

    expect(await screen.findByRole('link', { name: /Root/ })).toHaveAttribute(
      'href',
      `/workspaces/${WORKSPACE_ID}/${ROOT_ID}`,
    );
    expect(screen.getByRole('link', { name: /Leaf/ })).toHaveAttribute(
      'href',
      `/workspaces/${WORKSPACE_ID}/${LEAF_ID}`,
    );

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Развернуть «Leaf»' })).not.toBeInTheDocument(),
    );

    expect(fetchCalls).toBe(1);

    const rootLink = screen.getByRole('link', { name: /Root/ });
    await user.hover(rootLink);
    expect(fetchCalls).toBe(1);

    await user.click(screen.getByRole('button', { name: 'Развернуть «Root»' }));

    expect(await screen.findByRole('link', { name: /Nested/ })).toHaveAttribute(
      'href',
      `/workspaces/${WORKSPACE_ID}/${CHILD_ID}`,
    );
    expect(fetchCalls).toBe(2);
    expect(screen.getByRole('button', { name: 'Свернуть «Root»' })).toBeInTheDocument();
  });

  it('создаёт корневую страницу по кнопке в конце списка', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<PageTree workspaceId={WORKSPACE_ID} />, gateway);

    await screen.findByRole('link', { name: /Root/ });

    await user.click(screen.getByRole('button', { name: 'Создать страницу' }));

    await waitFor(() =>
      expect(routerPush).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/${CREATED_ID}`),
    );
  });

  it('показывает кнопку создания на корневом уровне и не показывает вложенным', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<PageTree workspaceId={WORKSPACE_ID} />, gateway);

    await screen.findByRole('link', { name: /Root/ });

    expect(screen.getAllByRole('button', { name: 'Создать страницу' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Развернуть «Root»' }));
    await screen.findByRole('link', { name: /Nested/ });

    expect(screen.getAllByRole('button', { name: 'Создать страницу' })).toHaveLength(1);
  });

  it('показывает базы данных рядом с их страницей, даже без дочерних страниц', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(
      <PageTree
        workspaceId={WORKSPACE_ID}
        hasExtras={(parentId) => parentId === LEAF_ID}
        extras={(parentId, depth) =>
          parentId === LEAF_ID ? (
            <li data-testid="leaf-database" data-depth={depth}>
              <a href={`/workspaces/${WORKSPACE_ID}/databases/db-1`}>Leaf database</a>
            </li>
          ) : null
        }
      />,
      gateway,
    );

    await screen.findByRole('link', { name: /Leaf/ });

    // Leaf has no child pages: only the database row makes it expandable.
    await user.click(screen.getByRole('button', { name: 'Развернуть «Leaf»' }));

    const extra = await screen.findByTestId('leaf-database');

    expect(screen.getByRole('link', { name: 'Leaf database' })).toBeInTheDocument();
    expect(extra).toHaveAttribute('data-depth', '1');
    expect(extra.closest('[role="treeitem"]')).toBe(
      screen.getByRole('link', { name: 'Leaf' }).closest('[role="treeitem"]'),
    );
  });
});
