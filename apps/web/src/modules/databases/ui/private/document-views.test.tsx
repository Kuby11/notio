// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type {
  DatabaseProperty,
  DatabaseRow,
  DatabaseView,
  DatabaseViewType,
} from '@notio/contracts';
import { renderWithIntl } from '../../../../../test/auth-fixture';
import { CalendarView } from './calendar-view';
import { GalleryView } from './gallery-view';
import { ListView } from './list-view';

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
];

const NOW = new Date();
const DUE_DATE = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-15`;
const DUE_LABEL = new Intl.DateTimeFormat('ru', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
}).format(new Date(`${DUE_DATE}T00:00:00`));

const ROWS: DatabaseRow[] = [
  {
    id: 'row-1',
    databaseId: 'db-1',
    workspaceId: 'ws-1',
    title: 'Ship the calendar view',
    properties: {
      status: 'done',
      due: { start: DUE_DATE },
    },
    isTrashed: false,
    createdBy: 'user-1',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
];

function view(type: DatabaseViewType): DatabaseView {
  return {
    id: `view-${type}`,
    databaseId: 'db-1',
    name: type,
    type,
    sorts: [],
    visiblePropertyIds: ['title', 'status', 'due'],
  };
}

describe('document database views', () => {
  it('renders list rows with their status and date', () => {
    renderWithIntl(
      <ListView
        properties={PROPERTIES}
        rows={ROWS}
        view={view('list')}
        onAddRow={vi.fn<() => void>()}
        onDeleteRow={vi.fn<(rowId: string) => void>()}
      />,
    );

    expect(screen.getByText('Ship the calendar view')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText(DUE_LABEL)).toBeInTheDocument();
  });

  it('renders gallery cards and adds a row', async () => {
    const user = userEvent.setup();
    const onAddRow = vi.fn<() => void>();

    renderWithIntl(
      <GalleryView
        properties={PROPERTIES}
        rows={ROWS}
        view={view('gallery')}
        onAddRow={onAddRow}
        onDeleteRow={vi.fn<(rowId: string) => void>()}
      />,
    );

    expect(screen.getByText('Ship the calendar view')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Создать' }));

    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  it('renders rows in the calendar month and navigates months', async () => {
    const user = userEvent.setup();

    renderWithIntl(<CalendarView properties={PROPERTIES} rows={ROWS} view={view('calendar')} />);

    expect(screen.getByText('Ship the calendar view')).toBeInTheDocument();
    const currentMonth = new Intl.DateTimeFormat('ru', {
      month: 'long',
      year: 'numeric',
    }).format(NOW);
    const nextMonthDate = new Date(NOW.getFullYear(), NOW.getMonth() + 1, 1);
    const nextMonth = new Intl.DateTimeFormat('ru', {
      month: 'long',
      year: 'numeric',
    }).format(nextMonthDate);

    expect(screen.getByText(currentMonth)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Следующий месяц' }));

    expect(screen.getByText(nextMonth)).toBeInTheDocument();
  });

  it('explains when a calendar has no date property', () => {
    renderWithIntl(
      <CalendarView
        properties={PROPERTIES.filter((property) => property.type !== 'date')}
        rows={ROWS}
        view={view('calendar')}
      />,
    );

    expect(
      screen.getByText('Добавьте свойство даты, чтобы использовать календарь.'),
    ).toBeInTheDocument();
  });
});
