// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { renderWithIntl, TEST_MESSAGES } from '../../../../../test/auth-fixture';
import { describe, expect, it, vi } from 'vitest';
import type { SlashCommand } from '../../utils/slash';
import { SlashMenu } from './slash-menu';

function selectMock() {
  return vi.fn<(command: SlashCommand) => void>();
}

function closeMock() {
  return vi.fn<() => void>();
}

describe('SlashMenu', () => {
  it('показывает все базовые блоки и их markdown-символы', () => {
    renderWithIntl(<SlashMenu query="" onSelect={selectMock()} onClose={closeMock()} />);

    const menu = screen.getByRole('listbox', { name: 'Вставить блок' });

    expect(within(menu).getAllByRole('option')).toHaveLength(33);
    expect(within(menu).getByRole('option', { name: /Текст/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Заголовок 4/ })).toBeInTheDocument();
    expect(within(menu).getByText('####')).toBeInTheDocument();

    const numbered = within(menu).getByRole('option', { name: /Нумерованный список/ });
    expect(within(numbered).getByText('1.', { selector: 'kbd' })).toBeInTheDocument();
    expect(within(menu).getByText('[]')).toBeInTheDocument();
    expect(within(menu).getByText('>')).toBeInTheDocument();

    // New blocks: quote, divider, table, sub-page, code.
    const quote = within(menu).getByRole('option', { name: /Цитата/ });
    expect(within(quote).getByText('"', { selector: 'kbd' })).toBeInTheDocument();
    const divider = within(menu).getByRole('option', { name: /Разделитель/ });
    expect(within(divider).getByText('---', { selector: 'kbd' })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Таблица/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Страница/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Код/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Изображение/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Видео/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Файл/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Эмодзи/ })).toBeInTheDocument();
    expect(
      within(menu).getByRole('option', { name: /Встроенная база данных/ }),
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole('option', { name: /База данных отдельной страницей/ }),
    ).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Горизонтальный график/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Вертикальный график/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Кольцевой график/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Линейный график/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Числовой график/ })).toBeInTheDocument();
  });

  it('фильтрует команды по запросу', () => {
    const { rerender } = renderWithIntl(
      <SlashMenu query="" onSelect={selectMock()} onClose={closeMock()} />,
    );

    rerender(
      <NextIntlClientProvider locale="ru" messages={TEST_MESSAGES}>
        <SlashMenu query="h1" onSelect={selectMock()} onClose={closeMock()} />
      </NextIntlClientProvider>,
    );

    const menu = screen.getByRole('listbox', { name: 'Вставить блок' });
    const options = within(menu).getAllByRole('option');

    expect(options).toHaveLength(1);
    expect(options[0]).toHaveAccessibleName(/Заголовок 1/);
  });

  it('выбирает команду стрелками и Enter', () => {
    const onSelect = selectMock();
    renderWithIntl(<SlashMenu query="" onSelect={onSelect} onClose={closeMock()} />);

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: 'heading1' });
  });

  it('вставляет команду по клику', () => {
    const onSelect = selectMock();
    renderWithIntl(<SlashMenu query="" onSelect={onSelect} onClose={closeMock()} />);

    fireEvent.click(screen.getByRole('option', { name: /Toggle-список/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: 'toggle' });
  });

  it('вставляет команду уже по pointerdown и не дублирует её на click', () => {
    const onSelect = selectMock();
    renderWithIntl(<SlashMenu query="" onSelect={onSelect} onClose={closeMock()} />);

    const option = screen.getByRole('option', { name: /Список задач/ });
    fireEvent.pointerDown(option, { button: 0 });
    fireEvent.click(option);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: 'checkList' });
  });

  it('закрывается по Escape', () => {
    const onClose = closeMock();
    renderWithIntl(<SlashMenu query="" onSelect={selectMock()} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
