// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { createDatabasesModule } from '../../index';
import { DatabasesTree } from './databases-tree';

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

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000041';
const PAGE_ID = '00000000-0000-4000-8000-000000000051';
const PAGE_WITH_VIEWS = '00000000-0000-4000-8000-000000000052';

/** The repository is in-memory in tests and shared with the container. */
function seedDatabase(parentId: string | null, title: string) {
  const databases = createDatabasesModule({
    accessToken: { execute: async () => 'jwt' },
  });

  return databases.create({
    workspaceId: WORKSPACE_ID,
    parentId,
    title,
    isInline: parentId !== null,
  });
}

describe('DatabasesTree', () => {
  it('показывает только базы данных этой страницы', async () => {
    await seedDatabase(PAGE_ID, 'Page database');
    await seedDatabase(null, 'Root database');
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<DatabasesTree workspaceId={WORKSPACE_ID} parentId={PAGE_ID} />, gateway);

    expect(await screen.findByRole('link', { name: /Page database/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Root database/ })).not.toBeInTheDocument();
  });

  it('выравнивает строку базы данных по уровню вложенности страницы', async () => {
    await seedDatabase(PAGE_ID, 'Nested database');
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(
      <DatabasesTree workspaceId={WORKSPACE_ID} parentId={PAGE_ID} depth={1} />,
      gateway,
    );

    const link = await screen.findByRole('link', { name: /Nested database/ });

    expect(link.closest('li')).toHaveStyle({ paddingLeft: '12px' });
  });

  it('раскрывает представления базы данных, как дочерние страницы', async () => {
    const user = userEvent.setup();
    await seedDatabase(PAGE_WITH_VIEWS, 'Expandable database');
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(
      <DatabasesTree workspaceId={WORKSPACE_ID} parentId={PAGE_WITH_VIEWS} />,
      gateway,
    );

    expect(screen.queryByRole('link', { name: 'Table' })).not.toBeInTheDocument();

    await user.click(
      await screen.findByRole('button', { name: 'Развернуть «Expandable database»' }),
    );

    const table = await screen.findByRole('link', { name: 'Table' });

    expect(table).toHaveAttribute(
      'href',
      expect.stringMatching(new RegExp(`^/workspaces/${WORKSPACE_ID}/databases/.+\\?view=`)),
    );
    expect(screen.getByRole('link', { name: 'Board' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chart' })).toBeInTheDocument();
  });

  it('удаляет базу данных после подтверждения в модальном окне', async () => {
    const user = userEvent.setup();
    await seedDatabase(PAGE_ID, 'Deletable database');
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<DatabasesTree workspaceId={WORKSPACE_ID} parentId={PAGE_ID} />, gateway);

    await user.click(await screen.findByRole('button', { name: 'Удалить «Deletable database»' }));

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Удалить базу данных?')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Удалить базу данных' }));

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /Deletable database/ })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
