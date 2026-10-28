// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TURN_INTO_OPTIONS, type TurnIntoOption } from '../../utils/block-actions';
import { renderWithIntl } from '../../../../../test/auth-fixture';
import { BlockActionsMenu } from './block-actions-menu';

const POSITION = { top: 10, left: 20 };

const baseProps = {
  position: POSITION,
  canTurnInto: true,
  canColor: true,
  turnIntoOptions: TURN_INTO_OPTIONS,
  currentTurnIntoId: 'text',
  currentColor: null,
  currentBackground: null,
  canReplace: false,
  canDownload: false,
  onClose: vi.fn<() => void>(),
};

function renderMenu(overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, ...overrides };

  const onTurnInto = vi.fn<(option: TurnIntoOption) => void>();
  const onSetColor = vi.fn<(color: string | null) => void>();
  const onSetBackground = vi.fn<(background: string | null) => void>();
  const onReplace = vi.fn<() => void>();
  const onDownload = vi.fn<() => void>();
  const onDelete = vi.fn<() => void>();
  const onDuplicate = vi.fn<() => void>();

  renderWithIntl(
    <BlockActionsMenu
      {...props}
      onTurnInto={onTurnInto}
      onSetColor={onSetColor}
      onSetBackground={onSetBackground}
      onReplace={onReplace}
      onDownload={onDownload}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
    />,
  );

  return {
    onTurnInto,
    onSetColor,
    onSetBackground,
    onReplace,
    onDownload,
    onDelete,
    onDuplicate,
    onClose: props.onClose,
  };
}

describe('BlockActionsMenu', () => {
  it('показывает четыре действия блока', () => {
    renderMenu();

    expect(screen.getByRole('menu', { name: 'Действия с блоком' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Превратить в' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Цвет' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Дублировать' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Удалить' })).toBeInTheDocument();
  });

  it('вызывает удаление и дублирование', () => {
    const { onDelete, onDuplicate } = renderMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Дублировать' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('открывает список превращения и применяет выбранный тип', () => {
    const { onTurnInto } = renderMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Превратить в' }));

    expect(screen.getByRole('group', { name: 'Превратить в' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Заголовок 1/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Цитата/ })).toBeInTheDocument();

    // The current type is marked with a check.
    const current = screen.getByRole('menuitem', { name: /Текст/ });

    expect(current.querySelector('svg')).not.toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: /Цитата/ }));

    expect(onTurnInto).toHaveBeenCalledTimes(1);
    expect(onTurnInto.mock.calls[0]?.[0]).toMatchObject({ kind: 'quote' });
  });

  it('открывает цвета и выбирает пресет текста и фона', () => {
    const { onSetColor, onSetBackground } = renderMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Цвет' }));

    fireEvent.click(screen.getByRole('button', { name: 'Текст: Красный' }));
    fireEvent.click(screen.getByRole('button', { name: 'Фон: Синий' }));

    expect(onSetColor).toHaveBeenCalledWith('red');
    expect(onSetBackground).toHaveBeenCalledWith('blue');
  });

  it('показывает замену и скачивание для медиа-блока', () => {
    const { onReplace, onDownload } = renderMenu({ canReplace: true, canDownload: true });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Заменить' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Скачать' }));

    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('без медиа-источника замены и скачивания нет', () => {
    renderMenu();

    expect(screen.queryByRole('menuitem', { name: 'Заменить' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Скачать' })).not.toBeInTheDocument();
  });

  it('скрывает превращение и цвет для неподдерживаемых блоков', () => {
    renderMenu({ canTurnInto: false, canColor: false });

    expect(screen.queryByRole('menuitem', { name: 'Превратить в' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Цвет' })).not.toBeInTheDocument();
  });

  it('закрывается по Escape', async () => {
    const { onClose } = renderMenu();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
