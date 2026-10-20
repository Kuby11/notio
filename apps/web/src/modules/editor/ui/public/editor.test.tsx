// @vitest-environment jsdom
import { screen } from '@testing-library/react';
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
  });
});
