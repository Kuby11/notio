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

    const menu = screen.getByRole('listbox', { name: 'Insert block' });

    expect(within(menu).getAllByRole('option')).toHaveLength(33);
    expect(within(menu).getByRole('option', { name: /Text/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Heading 4/ })).toBeInTheDocument();
    expect(within(menu).getByText('####')).toBeInTheDocument();

    const numbered = within(menu).getByRole('option', { name: /Numbered list/ });
    expect(within(numbered).getByText('1.', { selector: 'kbd' })).toBeInTheDocument();
    expect(within(menu).getByText('[]')).toBeInTheDocument();
    expect(within(menu).getByText('>')).toBeInTheDocument();

    // New blocks: quote, divider, table, sub-page, code.
    const quote = within(menu).getByRole('option', { name: /Quote/ });
    expect(within(quote).getByText('"', { selector: 'kbd' })).toBeInTheDocument();
    const divider = within(menu).getByRole('option', { name: /Divider/ });
    expect(within(divider).getByText('---', { selector: 'kbd' })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Table/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Page/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Code/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Image/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Video/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /File/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Emoji/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Inline database/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Full page database/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Horizontal chart/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Vertical chart/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Donut chart/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Line chart/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Number chart/ })).toBeInTheDocument();
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

    const menu = screen.getByRole('listbox', { name: 'Insert block' });
    const options = within(menu).getAllByRole('option');

    expect(options).toHaveLength(1);
    expect(options[0]).toHaveAccessibleName(/Heading 1/);
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

    fireEvent.click(screen.getByRole('option', { name: /Toggle list/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: 'toggle' });
  });

  it('вставляет команду уже по pointerdown и не дублирует её на click', () => {
    const onSelect = selectMock();
    renderWithIntl(<SlashMenu query="" onSelect={onSelect} onClose={closeMock()} />);

    const option = screen.getByRole('option', { name: /To-do list/ });
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
