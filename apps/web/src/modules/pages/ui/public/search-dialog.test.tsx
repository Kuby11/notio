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
  it('показывает найденные страницы и открывает их по клику', async () => {
    stubFetch([page({ id: PAGE_ID, title: 'Дорожная карта', position: 'a0', icon: '🗺️' })]);
    const user = userEvent.setup();

    renderDialog({ initialQuery: 'Дор' });

    const result = await screen.findByRole('button', { name: /Дорожная карта/ });
    expect(result).toBeInTheDocument();

    await user.click(result);

    expect(routerPush).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/${PAGE_ID}`);
  });

  it('показывает пустое состояние, когда ничего не найдено', async () => {
    stubFetch([]);

    renderDialog({ initialQuery: 'Несуществующая' });

    expect(await screen.findByText('Страницы не найдены')).toBeInTheDocument();
  });

  it('не ищет с пустым запросом и показывает подсказку', async () => {
    stubFetch([]);

    renderDialog({ initialQuery: '' });

    expect(
      screen.getByText('Введите название страницы, чтобы найти её в пространстве'),
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('остальные категории показаны, но отключены — работает только поиск по страницам', async () => {
    stubFetch([]);

    renderDialog({ initialQuery: 'Дор' });

    expect(await screen.findByRole('button', { name: 'Страницы' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Чаты' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Только заголовок' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Автор' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'В' })).toBeDisabled();
  });

  it('подсказывает ошибку, когда поиск не загрузился', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('boom', { status: 500 })),
    );

    renderDialog({ initialQuery: 'Дор' });

    await waitFor(() => {
      expect(screen.getByText('Не удалось загрузить результаты поиска')).toBeInTheDocument();
    });
  });
});
