// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { createFakeDatabaseRepository } from '../../../../../test/database-fixture';
import { gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { DatabaseView } from './database-view';

const DB_ID = 'db-view-test-123';

describe('DatabaseView properties', () => {
  it('добавляет свойство выбранного типа из заголовка таблицы', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    const user = userEvent.setup();

    renderWithProviders(<DatabaseView databaseId={DB_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    expect(await screen.findByText('Project Tasks')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New property' }));
    await user.click(await screen.findByRole('button', { name: 'Number' }));

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Number' })).toHaveLength(1);
    });
  });

  it('переименовывает свойство и скрывает его из текущего представления', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    const user = userEvent.setup();

    renderWithProviders(<DatabaseView databaseId={DB_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    await screen.findByText('Project Tasks');

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
});
