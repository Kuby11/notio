// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@notio/contracts';
import { gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { PageActionsMenu } from './page-actions-menu';

const routerPush = vi.hoisted(() => vi.fn<(href: string) => void>());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    refresh: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  }),
  // Literal path: vi.mock factories run before the module constants below are
  // initialised, so interpolating them here would produce “undefined” segments.
  usePathname: () =>
    '/workspaces/00000000-0000-4000-8000-000000000061/00000000-0000-4000-8000-000000000071',
}));

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000061';
const PAGE_ID = '00000000-0000-4000-8000-000000000071';
const PAGE: Page = {
  id: PAGE_ID,
  workspaceId: WORKSPACE_ID,
  parentId: null,
  title: 'Open page',
  position: 'a0',
  isFavorite: false,
  isTrashed: false,
  createdBy: '00000000-0000-4000-8000-000000000081',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  vi.unstubAllGlobals();
  routerPush.mockClear();
});

describe('PageActionsMenu', () => {
  it('navigates to the workspace home after trashing the open page', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    const fetchMock = vi.fn<() => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ ...PAGE, isTrashed: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );

    vi.stubGlobal('fetch', fetchMock);

    renderWithProviders(
      <PageActionsMenu page={PAGE} workspaceId={WORKSPACE_ID} align="start" />,
      gateway,
    );

    await user.click(screen.getByRole('button', { name: 'Page menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move to trash' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}`);
    });
  });
});
