// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SlashCommand } from '../../utils/slash';
import { SlashMenu } from './slash-menu';

const POSITION = { top: 10, left: 20 };

function selectMock() {
  return vi.fn<(command: SlashCommand) => void>();
}

function closeMock() {
  return vi.fn<() => void>();
}

describe('SlashMenu', () => {
  it('показывает все базовые блоки и их markdown-символы', () => {
    render(
      <SlashMenu query="" position={POSITION} onSelect={selectMock()} onClose={closeMock()} />,
    );

    const menu = screen.getByRole('listbox', { name: 'Вставить блок' });

    expect(within(menu).getAllByRole('option')).toHaveLength(9);
    expect(within(menu).getByRole('option', { name: /Текст/ })).toBeInTheDocument();
    expect(within(menu).getByRole('option', { name: /Заголовок 4/ })).toBeInTheDocument();
    expect(within(menu).getByText('####')).toBeInTheDocument();

    const numbered = within(menu).getByRole('option', { name: /Нумерованный список/ });
    expect(within(numbered).getByText('1.', { selector: 'kbd' })).toBeInTheDocument();
    expect(within(menu).getByText('[]')).toBeInTheDocument();
    expect(within(menu).getByText('>')).toBeInTheDocument();
  });

  it('фильтрует команды по запросу', () => {
    const { rerender } = render(
      <SlashMenu query="" position={POSITION} onSelect={selectMock()} onClose={closeMock()} />,
    );

    rerender(
      <SlashMenu query="h1" position={POSITION} onSelect={selectMock()} onClose={closeMock()} />,
    );

    const menu = screen.getByRole('listbox', { name: 'Вставить блок' });
    const options = within(menu).getAllByRole('option');

    expect(options).toHaveLength(1);
    expect(options[0]).toHaveAccessibleName(/Заголовок 1/);
  });

  it('выбирает команду стрелками и Enter', () => {
    const onSelect = selectMock();
    render(<SlashMenu query="" position={POSITION} onSelect={onSelect} onClose={closeMock()} />);

    fireEvent.keyDown(document, { key: 'ArrowDown' });
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: 'heading1' });
  });

  it('вставляет команду по клику', () => {
    const onSelect = selectMock();
    render(<SlashMenu query="" position={POSITION} onSelect={onSelect} onClose={closeMock()} />);

    fireEvent.click(screen.getByRole('option', { name: /Toggle-список/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: 'toggle' });
  });

  it('вставляет команду уже по pointerdown и не дублирует её на click', () => {
    const onSelect = selectMock();
    render(<SlashMenu query="" position={POSITION} onSelect={onSelect} onClose={closeMock()} />);

    const option = screen.getByRole('option', { name: /Список задач/ });
    fireEvent.pointerDown(option, { button: 0 });
    fireEvent.click(option);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ id: 'checkList' });
  });

  it('закрывается по Escape', () => {
    const onClose = closeMock();
    render(<SlashMenu query="" position={POSITION} onSelect={selectMock()} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
