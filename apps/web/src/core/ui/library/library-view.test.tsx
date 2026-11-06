// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  gatewayStub,
  renderWithProviders,
  SESSION,
  sessionOf,
} from '../../../../test/auth-fixture';
import { LibraryView } from './library-view';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn<(href: string) => void>(),
    replace: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    refresh: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  }),
  usePathname: () => '/',
}));

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const ME = '00000000-0000-4000-8000-00000000000a';
const OTHER_USER = '00000000-0000-4000-8000-00000000000b';

/** The session user id has to be a UUID: page rows are validated against the contract. */
const MY_SESSION = { ...SESSION, user: { ...SESSION.user, id: ME } };

function page(id: string, title: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    workspaceId: WORKSPACE_ID,
    parentId: null,
    title,
    position: 'a0',
    isFavorite: false,
    isTrashed: false,
    createdBy: ME,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-26T10:00:00.000Z',
    ...overrides,
  };
}

const ROOT = page('00000000-0000-4000-8000-0000000000a1', 'Проект', {
  hasChildren: true,
  isFavorite: true,
});
const CHILD = page('00000000-0000-4000-8000-0000000000a2', 'Заметки', {
  parentId: ROOT.id,
  createdBy: OTHER_USER,
});

/** The library reads pages, members and the session: the network is stubbed. */
function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/members')
        ? {
            items: [
              {
                workspaceId: WORKSPACE_ID,
                userId: ME,
                role: 'owner',
                user: { id: ME, email: MY_SESSION.user.email, name: 'Anna' },
                createdAt: '2026-10-01T10:00:00.000Z',
                updatedAt: '2026-10-01T10:00:00.000Z',
              },
              {
                workspaceId: WORKSPACE_ID,
                userId: OTHER_USER,
                role: 'editor',
                user: { id: OTHER_USER, email: 'boris@notio.dev', name: 'Борис' },
                createdAt: '2026-10-01T10:00:00.000Z',
                updatedAt: '2026-10-01T10:00:00.000Z',
              },
            ],
          }
        : { items: [ROOT, CHILD], nextCursor: null };

      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

beforeEach(() => {
  stubFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderLibrary() {
  const gateway = gatewayStub({ currentSession: sessionOf(MY_SESSION) });
  // The repository asks for a JWT before every request: without it the list fails with 401.
  gateway.accessToken.mockResolvedValue('jwt');

  return renderWithProviders(<LibraryView workspaceId={WORKSPACE_ID} />, gateway);
}

describe('LibraryView', () => {
  it('показывает все страницы workspace с автором и источником', async () => {
    renderLibrary();

    const table = await screen.findByRole('table', { name: 'Pages in this workspace' });

    // Wait for the rows: the table itself renders while the list is loading.
    await within(table).findByText('Заметки');
    const rows = within(table).getAllByRole('row');

    // Header plus both pages: the nested one is visible without expanding.
    expect(rows).toHaveLength(3);
    // The parent title also appears in the child's "Source" cell.
    expect(within(table).getAllByText('Проект').length).toBeGreaterThan(0);
    expect(within(table).getByText('Anna')).toBeInTheDocument();
    expect(within(table).getByText('Борис')).toBeInTheDocument();
    // The root page has no parent: its source is "private".
    expect(within(table).getByText('Private')).toBeInTheDocument();
  });

  it('сворачивает ветку по шеврону', async () => {
    const user = userEvent.setup();
    renderLibrary();

    await screen.findByText('Заметки');
    await user.click(screen.getByRole('button', { name: 'Collapse “Проект”' }));

    expect(screen.queryByText('Заметки')).not.toBeInTheDocument();
    expect(screen.getByText('Проект')).toBeInTheDocument();
  });

  it('фильтрует по избранному', async () => {
    const user = userEvent.setup();
    renderLibrary();

    await screen.findByText('Заметки');
    await user.click(screen.getByRole('button', { name: 'Favorites' }));

    expect(screen.getByText('Проект')).toBeInTheDocument();
    expect(screen.queryByText('Заметки')).not.toBeInTheDocument();
  });

  it('searches by title', async () => {
    const user = userEvent.setup();
    renderLibrary();

    await screen.findByText('Заметки');
    await user.click(screen.getByRole('button', { name: 'Search pages' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search pages…' }), 'Замет');

    const table = screen.getByRole('table', { name: 'Pages in this workspace' });

    // Only the matching page is left: header plus one row.
    expect(within(table).getByText('Заметки')).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(2);
  });
});
