// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithIntl } from '../../../test/auth-fixture';
import { Toaster, toast } from './toast';

describe('Toaster', () => {
  it('показывает тост и убирает по клику', async () => {
    renderWithIntl(<Toaster />);

    toast('Файл больше лимита 20 МБ', 'error');

    const item = await screen.findByRole('alert');

    expect(item).toHaveTextContent('Файл больше лимита 20 МБ');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('успешный тост получает роль status', async () => {
    renderWithIntl(<Toaster />);

    toast('Загружено', 'success');

    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});
