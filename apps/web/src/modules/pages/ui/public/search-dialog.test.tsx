// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@notio/contracts';
import { gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { SearchDialog } from './search-dialog';

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
  usePathname: () => '/',
}));

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000010';
const PAGE_ID = '00000000-0000-4000-8000-000000000101';
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

/**
 * The dialog fetches `/api/pages/search`; the stub answers it with the given
 * pages and returns empty lists for any other request.
 */
function stubFetch(items: Page[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/api/pages/search')
        ? { items, nextCursor: null }
        : { items: [], nextCursor: null };

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

function renderDialog(props: { initialQuery?: string; open?: boolean } = {}) {
  const gateway = gatewayStub();
  gateway.accessToken.mockResolvedValue('jwt');

  return renderWithProviders(
    <SearchDialog
      workspaceId={WORKSPACE_ID}
      open={props.open ?? true}
      initialQuery={props.initialQuery ?? ''}
      onOpenChange={vi.fn<(open: boolean) => void>()}
    />,
    gateway,
  );
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_GATEWAY_URL', 'http://localhost:8787');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  routerPush.mockClear();
});

describe('SearchDialog', () => {
  it('shows found pages and opens them on click', async () => {
    stubFetch([page({ id: PAGE_ID, title: 'Roadmap', position: 'a0', icon: '🗺️' })]);
    const user = userEvent.setup();

    renderDialog({ initialQuery: 'Roa' });

    const result = await screen.findByRole('button', { name: /Roadmap/ });
    expect(result).toBeInTheDocument();

    await user.click(result);

    expect(routerPush).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/${PAGE_ID}`);
  });

  it('shows the empty state when nothing is found', async () => {
    stubFetch([]);

    renderDialog({ initialQuery: 'Nonexistent' });

    expect(await screen.findByText('No pages found')).toBeInTheDocument();
  });

  it('does not search with an empty query and shows the hint', async () => {
    stubFetch([]);

    renderDialog({ initialQuery: '' });

    expect(screen.getByText('Type a page title to search this workspace')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows other categories but disabled: only page search works', async () => {
    stubFetch([]);

    renderDialog({ initialQuery: 'Roa' });

    expect(await screen.findByRole('button', { name: 'Pages' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Chats' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Title only' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Created by' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'In' })).toBeDisabled();
  });

  it('shows an error when the search fails to load', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );

    renderDialog({ initialQuery: 'Roa' });

    await waitFor(() => {
      expect(screen.getByText('Could not load search results')).toBeInTheDocument();
    });
  });
});
