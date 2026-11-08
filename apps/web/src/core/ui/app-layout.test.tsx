// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gatewayStub, renderWithProviders } from '../../../test/auth-fixture';
import { useSidebarStore } from '../stores/sidebar.store';
import { AppLayout } from './app-layout';

const routerPush = vi.hoisted(() => vi.fn<(href: string) => void>());

// The sidebar profile uses useRouter and the page tree reads the current path.
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

/** The shell fetches the workspace list and the tree: empty collections are enough. */
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
  useSidebarStore.setState({ collapsed: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AppLayout', () => {
  it('shows no expand button while the panel is open', () => {
    renderWithProviders(
      <AppLayout workspaceId={WORKSPACE_ID}>
        <div>content</div>
      </AppLayout>,
      gatewayStub(),
    );

    expect(screen.queryByRole('button', { name: 'Open sidebar' })).not.toBeInTheDocument();
  });

  it('gives every shell page an expand button and room for it', async () => {
    const user = userEvent.setup();
    useSidebarStore.setState({ collapsed: true });

    renderWithProviders(
      <AppLayout workspaceId={WORKSPACE_ID}>
        <div>content</div>
      </AppLayout>,
      gatewayStub(),
    );

    // One control in the shell, not per page: the content routes do not render it.
    const open = screen.getByRole('button', { name: 'Open sidebar' });

    // The content keeps a gutter so the floating button cannot cover it.
    expect(screen.getByRole('main')).toHaveClass('pl-12');

    await user.click(open);

    expect(useSidebarStore.getState().collapsed).toBe(false);
  });
});
