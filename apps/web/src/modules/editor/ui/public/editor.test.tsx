// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Block, BlockContent } from '@notio/contracts';
import { gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { useEditorStore } from '../../stores/editor.store';
import { Editor } from './editor';

const PAGE_ID = '00000000-0000-4000-8000-000000000001';
const PARAGRAPH_ID = '00000000-0000-4000-8000-000000000101';
const HEADING_ID = '00000000-0000-4000-8000-000000000102';
const BULLET_ID = '00000000-0000-4000-8000-000000000103';
const TODO_ID = '00000000-0000-4000-8000-000000000104';
const QUOTE_ID = '00000000-0000-4000-8000-000000000105';
const CODE_ID = '00000000-0000-4000-8000-000000000106';
const DIVIDER_ID = '00000000-0000-4000-8000-000000000107';
const IMAGE_ID = '00000000-0000-4000-8000-000000000108';
const TOGGLE_ID = '00000000-0000-4000-8000-000000000109';
const FILE_ID = '00000000-0000-4000-8000-000000000110';
const NOW = '2026-01-01T00:00:00.000Z';

function block(id: string, position: string, content: BlockContent): Block {
  return {
    id,
    pageId: PAGE_ID,
    type: content.type,
    position,
    content,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function mockBlockResponse(blocks: Block[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return new Response(JSON.stringify({ items: blocks, nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

const BLOCKS: Block[] = [
  block(PARAGRAPH_ID, 'a0', { type: 'paragraph', content: 'Первый абзац' }),
  block(HEADING_ID, 'a1', { type: 'heading', level: 2, content: 'Заголовок' }),
  block(BULLET_ID, 'a2', { type: 'bulletedListItem', content: 'Пункт списка' }),
  block(TODO_ID, 'a3', { type: 'toDo', checked: false, content: 'Задача' }),
  block(QUOTE_ID, 'a4', { type: 'quote', content: 'Цитата' }),
  block(CODE_ID, 'a5', { type: 'code', language: 'ts', content: 'const x = 1;' }),
  block(DIVIDER_ID, 'a6', { type: 'divider' }),
  block(IMAGE_ID, 'a7', { type: 'image', fileId: FILE_ID, caption: 'Подпись' }),
  block(TOGGLE_ID, 'a8', { type: 'toggle', content: 'Переключатель' }),
];

beforeEach(() => {
  useEditorStore.getState().setSelectedBlock(null);
  useEditorStore.getState().closeSlashMenu();
  mockBlockResponse(BLOCKS);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Editor', () => {
  it('гидратирует блоки в Tiptap и рендерит их типами', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<Editor pageId={PAGE_ID} />, gateway);

    expect(await screen.findByText('Первый абзац')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Заголовок' })).toBeInTheDocument();
    expect(screen.getByText('Пункт списка')).toBeInTheDocument();
    expect(screen.getByText('Задача')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Отметить задачу' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByText('Задача').closest('[data-block-id]')).toHaveAttribute(
      'data-block-id',
      TODO_ID,
    );
    expect(screen.getByText('Цитата')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    expect(screen.getByText('Подпись')).toBeInTheDocument();
    expect(screen.getByText('Переключатель')).toBeInTheDocument();
    expect(document.querySelector(`hr[data-block-id="${DIVIDER_ID}"]`)).not.toBeNull();

    expect(screen.getByText('Первый абзац').closest('[data-block-id]')).toHaveAttribute(
      'data-block-id',
      PARAGRAPH_ID,
    );
    expect(screen.getByText('Пункт списка').closest('[data-block-id]')).toHaveAttribute(
      'data-block-id',
      BULLET_ID,
    );

    const bulletItem = screen.getByText('Пункт списка').closest('li');
    expect(bulletItem).toHaveClass('notion-list-item');
    expect(bulletItem?.querySelector('.notion-list-marker')).not.toBeNull();
  });

  it('переключает чек-лист и зачёркивает выполненную задачу', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(TODO_ID, 'a0', { type: 'toDo', checked: false, content: 'Задача' })]);

    renderWithProviders(<Editor pageId={PAGE_ID} />, gateway);

    const checkbox = await screen.findByRole('checkbox', { name: 'Отметить задачу' });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Снять отметку' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(screen.getByText('Задача').closest('.line-through')).not.toBeNull();
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Снять отметку' }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Отметить задачу' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(screen.getByText('Задача').closest('.line-through')).toBeNull();
    });
  });

  it('показывает подсказку в пустом чек-листе', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(TODO_ID, 'a0', { type: 'toDo', checked: false, content: '' })]);

    renderWithProviders(<Editor pageId={PAGE_ID} />, gateway);

    await screen.findByRole('checkbox', { name: 'Отметить задачу' });
    await waitFor(() => {
      expect(screen.getByText('Press / for commands')).toBeInTheDocument();
    });
  });

  it('показывает подсказку в текущей пустой строке', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(PARAGRAPH_ID, 'a0', { type: 'paragraph', content: '' })]);

    renderWithProviders(<Editor pageId={PAGE_ID} />, gateway);

    await screen.findByRole('textbox');
    await waitFor(() => {
      const emptyBlock = document.querySelector('.ProseMirror [data-placeholder]');
      expect(emptyBlock).toHaveAttribute('data-placeholder', 'Press / for commands');
    });
  });

  it('показывает подсказку и кастомный маркер в пустом пункте списка', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(BULLET_ID, 'a0', { type: 'bulletedListItem', content: '' })]);

    renderWithProviders(<Editor pageId={PAGE_ID} />, gateway);

    await screen.findByRole('textbox');
    await waitFor(() => {
      const emptyBlock = document.querySelector('.ProseMirror li [data-placeholder]');
      expect(emptyBlock).toHaveAttribute('data-placeholder', 'Press / for commands');
      expect(emptyBlock?.closest('li')?.querySelector('.notion-list-marker')).not.toBeNull();
    });
  });
});
