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
  lastEditedBy: null as { name: string; image?: string | null } | null,
  lastEditedAt: null as string | null,
  stats: null as { words: number; characters: number } | null,
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
  it('shows the four block actions', () => {
    renderMenu();

    expect(screen.getByRole('menu', { name: 'Block actions' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Turn into' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Color' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('triggers delete and duplicate', () => {
    const { onDelete, onDuplicate } = renderMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('opens the turn-into list and applies the selected type', () => {
    const { onTurnInto } = renderMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Turn into' }));

    expect(screen.getByRole('group', { name: 'Turn into' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Heading 1/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Quote/ })).toBeInTheDocument();

    // The current type is marked with a check.
    const current = screen.getByRole('menuitem', { name: /Text/ });

    expect(current.querySelector('svg')).not.toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: /Quote/ }));

    expect(onTurnInto).toHaveBeenCalledTimes(1);
    expect(onTurnInto.mock.calls[0]?.[0]).toMatchObject({ kind: 'quote' });
  });

  it('opens colors and picks a text and background preset', () => {
    const { onSetColor, onSetBackground } = renderMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Color' }));

    fireEvent.click(screen.getByRole('button', { name: 'Text color: Red' }));
    fireEvent.click(screen.getByRole('button', { name: 'Background: Blue' }));

    expect(onSetColor).toHaveBeenCalledWith('red');
    expect(onSetBackground).toHaveBeenCalledWith('blue');
  });

  it('shows replace and download for a media block', () => {
    const { onReplace, onDownload } = renderMenu({ canReplace: true, canDownload: true });

    fireEvent.click(screen.getByRole('menuitem', { name: 'Replace' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Download' }));

    expect(onReplace).toHaveBeenCalledTimes(1);
    expect(onDownload).toHaveBeenCalledTimes(1);
  });

  it('offers no replace or download without a media source', () => {
    renderMenu();

    expect(screen.queryByRole('menuitem', { name: 'Replace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Download' })).not.toBeInTheDocument();
  });

  it('hides turn-into and color for unsupported blocks', () => {
    renderMenu({ canTurnInto: false, canColor: false });

    expect(screen.queryByRole('menuitem', { name: 'Turn into' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Color' })).not.toBeInTheDocument();
  });

  it('shows who last edited the block and how big it is', () => {
    renderMenu({
      lastEditedBy: { name: 'STENDER11' },
      lastEditedAt: '2026-10-24T19:14:00.000Z',
      stats: { words: 31, characters: 151 },
    });

    expect(screen.getByText('Last edited')).toBeInTheDocument();
    expect(screen.getByText('STENDER11')).toBeInTheDocument();
    expect(screen.getByText(/31.*151/)).toBeInTheDocument();
  });

  it('keeps the block menu to actions when nothing is known about the edit', () => {
    renderMenu();

    expect(screen.queryByText('Last edited')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { onClose } = renderMenu();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
