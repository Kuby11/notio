// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  ChartConfig,
  DatabaseProperty,
  DatabaseView,
  DatabaseViewType,
  UpdateViewInput,
} from '@notio/contracts';
import { renderWithIntl } from '../../../../../test/auth-fixture';
import { ChartSettingsSheet } from './chart-settings-sheet';

const PROPERTIES: DatabaseProperty[] = [
  { id: 'title', name: 'Name', type: 'title' },
  {
    id: 'status',
    name: 'Status',
    type: 'status',
    statusConfig: {
      options: [{ id: 'done', name: 'Done', color: 'green', group: 'complete' }],
    },
  },
  { id: 'due', name: 'Due date', type: 'date' },
  { id: 'amount', name: 'Amount', type: 'number' },
];

function chart(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    sort: 'count_desc',
    aggregation: 'count_all',
    referenceLines: [],
    color: 'auto',
    ...overrides,
  };
}

function view(type: DatabaseViewType): DatabaseView {
  return {
    id: 'view-1',
    databaseId: 'db-1',
    name: 'Chart',
    type,
    sorts: [],
    visiblePropertyIds: [],
    chart: chart({ groupPropertyId: 'status' }),
  };
}

function renderSheet(
  type: DatabaseViewType,
  onUpdateView = vi.fn<(input: UpdateViewInput) => void>(),
  onChangeType = vi.fn<(type: DatabaseViewType) => void>(),
) {
  renderWithIntl(
    <ChartSettingsSheet
      open
      onOpenChange={vi.fn<(open: boolean) => void>()}
      properties={PROPERTIES}
      view={view(type)}
      databaseTitle="Tasks"
      onChangeType={onChangeType}
      onUpdateView={onUpdateView}
    />,
  );

  return { onUpdateView, onChangeType };
}

describe('ChartSettingsSheet', () => {
  it('shows X and Y settings for cartesian charts', () => {
    renderSheet('chart_vertical');

    expect(screen.getByText('Настройки представления')).toBeInTheDocument();
    expect(screen.getByText('Ось X')).toBeInTheDocument();
    expect(screen.getByText('Ось Y')).toBeInTheDocument();
    expect(screen.getByText('Стиль')).toBeInTheDocument();
  });

  it('shows only data settings for donut charts', () => {
    renderSheet('chart_donut');

    expect(screen.getByText('Данные')).toBeInTheDocument();
    expect(screen.getByText('Группировка')).toBeInTheDocument();
    expect(screen.queryByText('Ось X')).not.toBeInTheDocument();
    expect(screen.queryByText('Ось Y')).not.toBeInTheDocument();
    expect(screen.queryByText('Стиль')).not.toBeInTheDocument();
  });

  it('shows only data settings for number charts', () => {
    renderSheet('chart_number');

    expect(screen.getByText('Данные')).toBeInTheDocument();
    expect(screen.getByText('Что показывать')).toBeInTheDocument();
    expect(screen.queryByText('Ось X')).not.toBeInTheDocument();
    expect(screen.queryByText('Ось Y')).not.toBeInTheDocument();
    expect(screen.queryByText('Группировка')).not.toBeInTheDocument();
  });

  it('updates the chart grouping from the X axis control', async () => {
    const user = userEvent.setup();
    const { onUpdateView } = renderSheet('chart_vertical');

    const groupControl = screen.getAllByText('Что показывать')[0];

    if (!groupControl) {
      throw new Error('X axis property control not found');
    }

    await user.click(groupControl);
    await user.click(await screen.findByRole('menuitem', { name: 'Due date' }));

    expect(onUpdateView).toHaveBeenCalledWith({
      chart: chart({ groupPropertyId: 'due' }),
    });
  });

  it('renames the chart on blur', async () => {
    const user = userEvent.setup();
    const { onUpdateView } = renderSheet('chart_vertical');
    const input = screen.getByRole('textbox', { name: 'Название графика' });

    await user.clear(input);
    await user.type(input, 'Revenue');
    await user.tab();

    expect(onUpdateView).toHaveBeenCalledWith({ name: 'Revenue' });
  });

  it('sets a filter from the hidden filter editor', async () => {
    const user = userEvent.setup();
    const { onUpdateView } = renderSheet('chart_vertical');

    await user.click(screen.getByRole('button', { name: /Фильтр/ }));
    await user.click(screen.getByText('Выберите свойство'));
    await user.click(await screen.findByRole('menuitem', { name: 'Status' }));

    expect(onUpdateView).toHaveBeenCalledWith({
      filter: { propertyId: 'status', operator: 'is_not_empty' },
    });
  });

  it('uses a numeric property with an aggregation for the chart value', async () => {
    const user = userEvent.setup();
    const { onUpdateView } = renderSheet('chart_vertical');
    const valueControl = screen.getAllByText('Что показывать')[1];

    if (!valueControl) {
      throw new Error('Y axis value control not found');
    }

    await user.click(valueControl);
    await user.click(await screen.findByRole('menuitem', { name: 'Amount' }));

    expect(onUpdateView).toHaveBeenCalledWith({
      chart: chart({
        groupPropertyId: 'status',
        valuePropertyId: 'amount',
        aggregation: 'sum',
      }),
    });
  });
});
