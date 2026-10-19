// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gatewayStub, renderWithProviders } from '../../../test/auth-fixture';
import { AppSidebar } from './app-sidebar';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Сайдбар ходит в сеть за списком workspace, деревом и панелями.
 * Возвращаем пустые коллекции: тест проверяет только открытие модалок.
 */
function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/api/workspaces')
        ? { items: [] }
        : { items: [], nextCursor: null };

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

describe('AppSidebar', () => {
  it('открывает избранное в модальном окне, не уходя со страницы', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<AppSidebar workspaceId={WORKSPACE_ID} />, gateway);

    await user.click(screen.getByRole('button', { name: 'Избранное' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Избранное')).toBeInTheDocument();
    expect(await within(dialog).findByText('Пока нет избранных страниц')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('открывает корзину в модальном окне', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<AppSidebar workspaceId={WORKSPACE_ID} />, gateway);

    await user.click(screen.getByRole('button', { name: 'Корзина' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Корзина')).toBeInTheDocument();
    expect(await within(dialog).findByText('Корзина пуста')).toBeInTheDocument();
  });
});
