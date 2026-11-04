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
  it('открывает одно меню добавления со всеми типами графиков', async () => {
    const user = userEvent.setup();
    const props = renderTabs();

    await user.click(screen.getByRole('button', { name: 'Добавить представление' }));

    expect(
      await screen.findByRole('button', { name: 'Горизонтальный график' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вертикальный график' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Кольцевой график' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Линейный график' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Числовой график' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Горизонтальный график' }));

    expect(props.onAddView).toHaveBeenCalledWith('chart_horizontal', 'Горизонтальный график');
  });

  it('добавляет списочное, галерейное и календарное представления', async () => {
    const user = userEvent.setup();
    const props = renderTabs();

    await user.click(screen.getByRole('button', { name: 'Добавить представление' }));

    expect(await screen.findByRole('button', { name: 'Список' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Галерея' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Календарь' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Календарь' }));

    expect(props.onAddView).toHaveBeenCalledWith('calendar', 'Календарь');
  });

  it('переименовывает представление из меню вкладки', async () => {
    const user = userEvent.setup();
    const props = renderTabs();

    await user.click(screen.getByRole('tab', { name: /Table/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Переименовать представление' }));

    const input = await screen.findByRole('textbox', { name: 'Название представления' });

    await user.clear(input);
    await user.type(input, 'Tasks');
    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(props.onRenameView).toHaveBeenCalledWith(TABLE.id, 'Tasks');
  });

  it('дублирует и удаляет представление из меню вкладки', async () => {
    const user = userEvent.setup();
    const props = renderTabs();

    await user.click(screen.getByRole('tab', { name: /Table/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Дублировать представление' }));
    expect(props.onDuplicateView).toHaveBeenCalledWith(TABLE, 'Table (копия)');

    await user.click(screen.getByRole('tab', { name: /Table/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Удалить представление' }));

    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Удалить представление' }));

    expect(props.onDeleteView).toHaveBeenCalledWith(TABLE.id);
  });
});
