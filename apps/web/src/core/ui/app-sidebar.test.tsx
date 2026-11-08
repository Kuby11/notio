// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gatewayStub, renderWithProviders, SESSION, sessionOf } from '../../../test/auth-fixture';
import { useSidebarStore } from '../stores/sidebar.store';
import { AppSidebar } from './app-sidebar';

const routerPush = vi.hoisted(() => vi.fn<(href: string) => void>());

// The profile button uses useRouter and the page tree reads the current path:
// outside AppRouter the test substitutes navigation.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    refresh: vi.fn<() => void>(),
    prefetch: vi.fn<(href: string) => void>(),
  }),
  usePathname: () => '/',
}));

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * The sidebar fetches the workspace list, the tree and the panels from the network;
 * the session comes from the gateway stub (no fetch). Empty collections are
 * returned: the test only checks that the dialogs open.
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
  // The collapse state lives in a global store shared by all tests.
  useSidebarStore.setState({ collapsed: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
  routerPush.mockClear();
});

describe('AppSidebar', () => {
  it('opens favorites in a modal without leaving the page', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<AppSidebar workspaceId={WORKSPACE_ID} />, gateway);

    await user.click(screen.getByRole('button', { name: 'Favorites' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Favorites')).toBeInTheDocument();
    expect(await within(dialog).findByText('No favorite pages yet')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('opens the trash in a modal', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<AppSidebar workspaceId={WORKSPACE_ID} />, gateway);

    await user.click(screen.getByRole('button', { name: 'Trash' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Trash')).toBeInTheDocument();
    expect(await within(dialog).findByText('Trash is empty')).toBeInTheDocument();
  });

  it('opens page search on submit and passes the typed query', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<AppSidebar workspaceId={WORKSPACE_ID} />, gateway);

    const input = screen.getByRole('searchbox', { name: 'Search…' });
    await user.type(input, 'Roa');
    await user.keyboard('{Enter}');

    const dialog = await screen.findByRole('dialog');
    // The submitted text seeds the query inside the modal.
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: 'Search pages…' })).toHaveValue('Roa'),
    );
  });

  it('collapses the whole sidebar via the button, without the rail', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<AppSidebar workspaceId={WORKSPACE_ID} />, gateway);

    await user.click(screen.getByRole('button', { name: 'Close sidebar' }));

    expect(useSidebarStore.getState().collapsed).toBe(true);

    const aside = screen.getByRole('complementary', { hidden: true });

    // Full collapse: the width goes to zero, the border goes with it, and the
    // panel is out of the accessibility tree.
    expect(aside.className).toContain('w-0');
    expect(aside).toHaveAttribute('data-collapsed', 'true');
    expect(aside).toHaveAttribute('aria-hidden', 'true');

    // The markup stays mounted (the Ctrl+K dialog and the tree state live here)
    // but is no longer reachable.
    expect(screen.getByRole('searchbox', { hidden: true })).toBeInTheDocument();
  });

  it('toggles the sidebar with Ctrl + /', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<AppSidebar workspaceId={WORKSPACE_ID} />, gateway);

    await user.keyboard('{Control>}/{/Control}');

    expect(useSidebarStore.getState().collapsed).toBe(true);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

    await user.keyboard('{Control>}/{/Control}');

    expect(useSidebarStore.getState().collapsed).toBe(false);
    expect(screen.getByRole('searchbox', { name: 'Search…' })).toBeInTheDocument();
  });

  it('opens search with Ctrl + K even with a collapsed panel', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<AppSidebar workspaceId={WORKSPACE_ID} />, gateway);

    useSidebarStore.setState({ collapsed: true });

    await user.keyboard('{Control>}k{/Control}');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: 'Search pages…' })).toBeInTheDocument();
  });

  it('shows Library in the profile menu before Settings', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub({ currentSession: sessionOf(SESSION) });
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<AppSidebar workspaceId={WORKSPACE_ID} />, gateway);

    await user.click(await screen.findByRole('button', { name: /Anna/ }));

    const menu = await screen.findByRole('dialog');
    const library = within(menu).getByRole('button', { name: 'Library' });
    const settings = within(menu).getByRole('button', { name: 'Settings' });

    // Library comes right before Settings in the popover.
    expect(
      library.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(library);
    expect(routerPush).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}`);
  });
});
