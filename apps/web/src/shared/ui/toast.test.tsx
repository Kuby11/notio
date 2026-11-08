// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithIntl } from '../../../test/auth-fixture';
import { Toaster, toast } from './toast';

describe('Toaster', () => {
  it('shows a toast and removes it on click', async () => {
    renderWithIntl(<Toaster />);

    toast('File exceeds the 20 MB limit', 'error');

    const item = await screen.findByRole('alert');

    expect(item).toHaveTextContent('File exceeds the 20 MB limit');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('a success toast gets the status role', async () => {
    renderWithIntl(<Toaster />);

    toast('Uploaded', 'success');

    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});
