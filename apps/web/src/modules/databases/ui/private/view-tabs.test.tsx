// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseView, DatabaseViewType } from '@notio/contracts';
import { renderWithIntl } from '../../../../../test/auth-fixture';
import { ViewTabs } from './view-tabs';

const TABLE: DatabaseView = {
  id: 'view-table',
  databaseId: 'db-1',
  name: 'Table',
  type: 'table',
  sorts: [],
  visiblePropertyIds: ['title'],
};

const CHART: DatabaseView = {
  id: 'view-chart',
  databaseId: 'db-1',
  name: 'Chart',
  type: 'chart_vertical',
  sorts: [],
  visiblePropertyIds: [],
};

function renderTabs(overrides: Partial<React.ComponentProps<typeof ViewTabs>> = {}) {
  const props = {
    views: [TABLE, CHART],
    activeViewId: TABLE.id,
    onSelectView: vi.fn<(viewId: string) => void>(),
    onAddView: vi.fn<(type: DatabaseViewType, name: string) => void>(),
    onRenameView: vi.fn<(viewId: string, name: string) => void>(),
    onDuplicateView: vi.fn<(view: DatabaseView, name: string) => void>(),
    onDeleteView: vi.fn<(viewId: string) => void>(),
    onAddRow: vi.fn<() => void>(),
    ...overrides,
  };

  renderWithIntl(<ViewTabs {...props} />);

  return props;
}

describe('ViewTabs', () => {
  it('opens a single add menu with all chart types', async () => {
    const user = userEvent.setup();
    const props = renderTabs();

    await user.click(screen.getByRole('button', { name: 'Add view' }));

    expect(await screen.findByRole('button', { name: 'Horizontal chart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vertical chart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Donut chart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Line chart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Number chart' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Horizontal chart' }));

    expect(props.onAddView).toHaveBeenCalledWith('chart_horizontal', 'Horizontal chart');
  });

  it('adds list, gallery and calendar views', async () => {
    const user = userEvent.setup();
    const props = renderTabs();

    await user.click(screen.getByRole('button', { name: 'Add view' }));

    expect(await screen.findByRole('button', { name: 'List' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gallery' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Calendar' }));

    expect(props.onAddView).toHaveBeenCalledWith('calendar', 'Calendar');
  });

  it('only opens the view menu for the active tab', async () => {
    const user = userEvent.setup();
    const props = renderTabs();

    // Clicking another tab switches the view: its menu belongs to that view
    // only once it is active.
    await user.click(screen.getByRole('tab', { name: /Chart/ }));

    expect(props.onSelectView).toHaveBeenCalledWith(CHART.id);
    expect(screen.queryByRole('menuitem', { name: 'Rename view' })).not.toBeInTheDocument();
  });

  it('renames a view from the tab menu', async () => {
    const user = userEvent.setup();
    const props = renderTabs();

    await user.click(screen.getByRole('tab', { name: /Table/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Rename view' }));

    const input = await screen.findByRole('textbox', { name: 'View name' });

    await user.clear(input);
    await user.type(input, 'Tasks');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(props.onRenameView).toHaveBeenCalledWith(TABLE.id, 'Tasks');
  });

  it('duplicates and deletes a view from the tab menu', async () => {
    const user = userEvent.setup();
    const props = renderTabs();

    await user.click(screen.getByRole('tab', { name: /Table/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicate view' }));
    expect(props.onDuplicateView).toHaveBeenCalledWith(TABLE, 'Table copy');

    await user.click(screen.getByRole('tab', { name: /Table/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete view' }));

    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Delete view' }));

    expect(props.onDeleteView).toHaveBeenCalledWith(TABLE.id);
  });
});
