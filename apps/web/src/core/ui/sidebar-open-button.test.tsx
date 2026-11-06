// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithIntl } from '../../../test/auth-fixture';
import { useSidebarStore } from '../stores/sidebar.store';
import { SidebarOpenButton } from './sidebar-open-button';

beforeEach(() => {
  // The collapse state lives in a global store shared by all tests.
  useSidebarStore.setState({ collapsed: false });
});

describe('SidebarOpenButton', () => {
  it('не занимает место в топбаре, пока панель развёрнута', () => {
    renderWithIntl(<SidebarOpenButton />);

    expect(screen.queryByRole('button', { name: 'Open sidebar' })).not.toBeInTheDocument();
  });

  it('разворачивает свёрнутую панель', async () => {
    const user = userEvent.setup();
    useSidebarStore.setState({ collapsed: true });

    renderWithIntl(<SidebarOpenButton />);

    const button = screen.getByRole('button', { name: 'Open sidebar' });

    // The control points at the panel it expands.
    expect(button).toHaveAttribute('aria-controls', 'app-sidebar');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    await user.click(button);

    expect(useSidebarStore.getState().collapsed).toBe(false);
  });
});
