// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createFakeDatabaseRepository } from '../../../../../test/database-fixture';
import { gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { DatabaseView } from './database-view';

const DB_ID = 'db-view-test-123';

describe('DatabaseView properties', () => {
  it('adds a property of the selected type from the table header', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    const user = userEvent.setup();

    renderWithProviders(<DatabaseView databaseId={DB_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    // The title is an input: a database is renamed in place, like a page.
    expect(await screen.findByDisplayValue('Project Tasks')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New property' }));
    await user.click(await screen.findByRole('button', { name: 'Number' }));

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Number' })).toHaveLength(1);
    });
  });

  it('renames a property and hides it from the current view', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    const user = userEvent.setup();

    renderWithProviders(<DatabaseView databaseId={DB_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    await screen.findByDisplayValue('Project Tasks');

    await user.click(screen.getByRole('button', { name: 'Status' }));

    const input = screen.getByRole('textbox', { name: 'Property name' });

    await user.clear(input);
    await user.type(input, 'Stage{Enter}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stage' })).toBeInTheDocument();
    });

    // The rename popover is still open: close it before opening it again.
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Stage' }));
    await user.click(screen.getByRole('button', { name: 'Hide property' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Stage' })).not.toBeInTheDocument();
    });

    // Hidden properties are restored from the "new property" popover.
    await user.click(screen.getByRole('button', { name: 'New property' }));
    await user.click(await screen.findByRole('button', { name: 'Stage' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Stage' })).toBeInTheDocument();
    });
  });

  it('renames the database from its title field', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    const user = userEvent.setup();
    const databases = createFakeDatabaseRepository();
    const update = vi.spyOn(databases, 'update');

    renderWithProviders(<DatabaseView databaseId={DB_ID} />, gateway, { databases });

    const title = await screen.findByDisplayValue('Project Tasks');

    await user.clear(title);
    await user.type(title, 'Roadmap{Enter}');

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith(DB_ID, { title: 'Roadmap' });
    });
  });
});
