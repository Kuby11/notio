// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Block, BlockContent } from '@notio/contracts';
import { gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { createFakeDatabaseRepository } from '../../../../../test/database-fixture';
import { useEditorStore } from '../../stores/editor.store';
import { Editor } from './editor';

const routerPush = vi.hoisted(() => vi.fn<(href: string) => void>());

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: routerPush,
    replace: vi.fn<() => void>(),
    back: vi.fn<() => void>(),
    forward: vi.fn<() => void>(),
    refresh: vi.fn<() => void>(),
    prefetch: vi.fn<() => void>(),
  }),
}));

const PAGE_ID = '00000000-0000-4000-8000-000000000001';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000002';
const PARAGRAPH_ID = '00000000-0000-4000-8000-000000000101';
const HEADING_ID = '00000000-0000-4000-8000-000000000102';
const BULLET_ID = '00000000-0000-4000-8000-000000000103';
const TODO_ID = '00000000-0000-4000-8000-000000000104';
const QUOTE_ID = '00000000-0000-4000-8000-000000000105';
const CODE_ID = '00000000-0000-4000-8000-000000000106';
const DIVIDER_ID = '00000000-0000-4000-8000-000000000107';
const IMAGE_ID = '00000000-0000-4000-8000-000000000108';
const TOGGLE_ID = '00000000-0000-4000-8000-000000000109';
const TABLE_ID = '00000000-0000-4000-8000-000000000111';
const SUB_PAGE_ID = '00000000-0000-4000-8000-000000000112';
const SUB_PAGE_BLOCK_ID = '00000000-0000-4000-8000-000000000113';
const DATABASE_BLOCK_ID = '00000000-0000-4000-8000-000000000114';
const DATABASE_ID = '00000000-0000-4000-8000-000000000115';
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
  block(QUOTE_ID, 'a4', { type: 'quote', content: 'Quote' }),
  block(CODE_ID, 'a5', { type: 'code', language: 'ts', content: 'const x = 1;' }),
  block(DIVIDER_ID, 'a6', { type: 'divider' }),
  block(IMAGE_ID, 'a7', { type: 'image', fileId: FILE_ID, url: null, caption: 'Caption' }),
  block(TOGGLE_ID, 'a8', { type: 'toggle', content: 'Переключатель' }),
  block(TABLE_ID, 'a9', {
    type: 'table',
    headerRow: true,
    rows: [
      ['Name', 'Value'],
      ['Один', '1'],
    ],
  }),
  block(SUB_PAGE_BLOCK_ID, 'a10', {
    type: 'page',
    pageId: SUB_PAGE_ID,
    title: 'Child page',
    icon: '📄',
  }),
];

beforeEach(() => {
  useEditorStore.getState().setSelectedBlock(null);
  routerPush.mockClear();
  mockBlockResponse(BLOCKS);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Editor', () => {
  it('гидратирует блоки в Tiptap и рендерит их типами', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    expect(await screen.findByText('Первый абзац')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Заголовок' })).toBeInTheDocument();
    expect(screen.getByText('Пункт списка')).toBeInTheDocument();
    expect(screen.getByText('Задача')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Check' })).not.toBeChecked();
    expect(screen.getByText('Задача').closest('[data-block-id]')).toHaveAttribute(
      'data-block-id',
      TODO_ID,
    );
    expect(screen.getByText('Quote')).toBeInTheDocument();
    expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    // The image caption is an input inside the node view.
    expect(screen.getByDisplayValue('Caption')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Caption' })).toBeInTheDocument();
    expect(screen.getByText('Переключатель')).toBeInTheDocument();
    expect(document.querySelector(`hr[data-block-id="${DIVIDER_ID}"]`)).not.toBeNull();

    // Table: first row is the header, the second holds regular cells.
    const table = document.querySelector(`table[data-block-id="${TABLE_ID}"]`);
    expect(table).not.toBeNull();
    expect(table?.querySelectorAll('th')).toHaveLength(2);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    // Sub-page: a link with the page id and the title.
    expect(
      document.querySelector(`a[data-block-type="page"][data-page-id="${SUB_PAGE_ID}"]`),
    ).not.toBeNull();
    expect(screen.getByText('Child page')).toBeInTheDocument();

    expect(screen.getByText('Первый абзац').closest('[data-block-id]')).toHaveAttribute(
      'data-block-id',
      PARAGRAPH_ID,
    );
    expect(screen.getByText('Пункт списка').closest('[data-block-id]')).toHaveAttribute(
      'data-block-id',
      BULLET_ID,
    );

    const bulletItem = screen.getByText('Пункт списка').closest('li');
    expect(bulletItem).toHaveClass('notio-list-item');
    expect(bulletItem?.querySelector('.notio-list-marker')).not.toBeNull();
  });

  it('раскрывает и сворачивает toggle, поворачивая стрелку', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([
      block(TOGGLE_ID, 'a0', {
        type: 'toggle',
        content: 'Переключатель',
        children: [{ type: 'paragraph', content: 'Содержимое toggle' }],
      }),
    ]);

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    const collapse = await screen.findByRole('button', { name: 'Collapse toggle' });
    const details = screen.getByText('Переключатель').closest('[data-type="details"]');
    const content = details?.querySelector('[data-type="detailsContent"]');

    await waitFor(() => expect(details).toHaveClass('is-open'));
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    expect(details).toHaveAttribute('data-block-id', TOGGLE_ID);
    expect(content).not.toHaveAttribute('hidden');
    expect(screen.getByText('Содержимое toggle')).toBeInTheDocument();

    fireEvent.click(collapse);

    const expand = await screen.findByRole('button', { name: 'Expand toggle' });
    await waitFor(() => expect(details).not.toHaveClass('is-open'));
    expect(expand).toHaveAttribute('aria-expanded', 'false');
    expect(content).toHaveAttribute('hidden');

    fireEvent.click(expand);

    const reopened = await screen.findByRole('button', { name: 'Collapse toggle' });
    await waitFor(() => expect(details).toHaveClass('is-open'));
    expect(reopened).toHaveAttribute('aria-expanded', 'true');
    expect(content).not.toHaveAttribute('hidden');
  });

  it('переключает чек-лист и зачёркивает выполненную задачу', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(TODO_ID, 'a0', { type: 'toDo', checked: false, content: 'Задача' })]);

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    const checkbox = await screen.findByRole('checkbox', { name: 'Check' });
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Uncheck' })).toBeChecked();
      expect(screen.getByText('Задача').closest('li')).toHaveAttribute('data-checked', 'true');
    });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Uncheck' }));

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'Check' })).not.toBeChecked();
      expect(screen.getByText('Задача').closest('li')).toHaveAttribute('data-checked', 'false');
    });
  });

  it('показывает подсказку в пустом чек-листе', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(TODO_ID, 'a0', { type: 'toDo', checked: false, content: '' })]);

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    await screen.findByRole('checkbox', { name: 'Check' });
    await waitFor(() => {
      const emptyBlock = document.querySelector('.ProseMirror li [data-placeholder]');
      expect(emptyBlock).toHaveAttribute('data-placeholder', 'Press / for commands');
    });
  });

  it('показывает подсказку в текущей пустой строке', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(PARAGRAPH_ID, 'a0', { type: 'paragraph', content: '' })]);

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    await screen.findByRole('textbox');
    await waitFor(() => {
      const emptyBlock = document.querySelector('.ProseMirror [data-placeholder]');
      expect(emptyBlock).toHaveAttribute('data-placeholder', 'Press / for commands');
    });
  });

  it('открывает подстраницу по клику на её ссылку', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([
      block(SUB_PAGE_BLOCK_ID, 'a0', {
        type: 'page',
        pageId: SUB_PAGE_ID,
        title: 'Child page',
        icon: '📄',
      }),
    ]);

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    const link = await screen.findByRole('link', { name: 'Child page' });

    fireEvent.click(link);

    expect(routerPush).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/${SUB_PAGE_ID}`);
  });

  it('рендерит видео, файл и эмодзи из контракта', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([
      block('00000000-0000-4000-8000-000000000201', 'a0', {
        type: 'video',
        fileId: null,
        url: 'https://example.com/clip.mp4',
        caption: 'Ролик',
      }),
      block('00000000-0000-4000-8000-000000000202', 'a1', {
        type: 'file',
        fileId: null,
        url: 'https://example.com/doc.pdf',
        name: 'doc.pdf',
        sizeBytes: 2048,
      }),
      block('00000000-0000-4000-8000-000000000203', 'a2', {
        type: 'emoji',
        emoji: '🚀',
      }),
    ]);

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    const video = await waitFor(() => {
      const element = document.querySelector('.ProseMirror figure video');

      expect(element).not.toBeNull();

      return element as HTMLVideoElement;
    });

    expect(video.getAttribute('src')).toBe('https://example.com/clip.mp4');
    expect(screen.getByDisplayValue('Ролик')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /doc.pdf/ });

    expect(link).toHaveAttribute('href', 'https://example.com/doc.pdf');
    expect(screen.getByText('2 KB')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '🚀' })).toHaveAttribute('title', 'Change emoji');
  });

  it('slash-меню открывается по «/» и переживает ререндер', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(PARAGRAPH_ID, 'a0', { type: 'paragraph', content: '' })]);

    // jsdom has no hit-testing, and userEvent clicks by coordinates:
    // ProseMirror.posAtCoords fails without elementFromPoint. Return the editor.
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => document.querySelector('.ProseMirror');

    try {
      renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
        databases: createFakeDatabaseRepository(),
      });

      const editable = await screen.findByRole('textbox');
      const user = userEvent.setup();

      await user.click(editable);
      await user.type(editable, '/');

      // Regression: an inline object in DragHandle's computePositionConfig forced the
      // plugin to re-register on every rerender (the autosave status
      // changes on each keystroke), and EditorState was recreated, killing the menu.
      const menu = await screen.findByRole('listbox', { name: 'Insert block' });

      expect(await screen.findAllByRole('option')).toHaveLength(33);
      await waitFor(() => expect(menu).toBeInTheDocument());
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('вставляет базу данных из slash-меню и создаёт её строку', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(PARAGRAPH_ID, 'a0', { type: 'paragraph', content: '' })]);

    // jsdom has no hit-testing: ProseMirror.posAtCoords needs elementFromPoint.
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => document.querySelector('.ProseMirror');

    try {
      renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
        databases: createFakeDatabaseRepository(),
      });

      const editable = await screen.findByRole('textbox');
      const user = userEvent.setup();

      await user.click(editable);
      await user.type(editable, '/database');

      const menu = await screen.findByRole('listbox', { name: 'Insert block' });

      expect(within(menu).getByRole('option', { name: /Full page database/ })).toBeInTheDocument();

      await user.keyboard('{Enter}');

      // The database row is created by the editor bridge; the node view renders it.
      expect(await screen.findByText('Untitled database')).toBeInTheDocument();
      expect(document.querySelector('[data-block-type="database"]')).not.toBeNull();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('вставляет график из slash-меню и открывает его представление', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(PARAGRAPH_ID, 'a0', { type: 'paragraph', content: '' })]);

    // jsdom has no hit-testing: ProseMirror.posAtCoords needs elementFromPoint.
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => document.querySelector('.ProseMirror');

    try {
      renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
        databases: createFakeDatabaseRepository(),
      });

      const editable = await screen.findByRole('textbox');
      const user = userEvent.setup();

      await user.click(editable);
      await user.type(editable, '/line');

      const menu = await screen.findByRole('listbox', { name: 'Insert block' });

      // fireEvent avoids the editor’s global mousemove bridge, which dispatches
      // a MouseEvent that jsdom cannot construct after the menu closes.
      fireEvent.click(within(menu).getByRole('option', { name: /Line chart/ }));

      // The chart view is selected by viewId on the new database block.
      expect(await screen.findByRole('button', { name: 'Chart type' })).toBeInTheDocument();
      expect(document.querySelector('[data-block-type="database"]')).not.toBeNull();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('рендерит блок базы данных через модуль databases', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([
      block(DATABASE_BLOCK_ID, 'a0', {
        type: 'database',
        databaseId: DATABASE_ID,
      }),
    ]);

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    // The injected repository seeds a starter database for the id.
    expect(await screen.findByText('Project Tasks')).toBeInTheDocument();
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(document.querySelector(`[data-database-id="${DATABASE_ID}"]`)).not.toBeNull();
  });

  it('файловый блок добирает имя и размер через HEAD', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    // GET — the block list; HEAD — file metadata from media-service.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? 'GET';

        if (method === 'HEAD') {
          return new Response(null, {
            status: 200,
            headers: {
              'content-length': '1234567',
              'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent('banner.png')}`,
            },
          });
        }

        return new Response(
          JSON.stringify({
            items: [
              block('00000000-0000-4000-8000-000000000201', 'a0', {
                type: 'file',
                fileId: FILE_ID,
                url: null,
                name: 'Image',
                sizeBytes: null,
              }),
            ],
            nextCursor: null,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }),
    );

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    // After HEAD: name from content-disposition, size from content-length.
    expect(await screen.findByText('banner.png')).toBeInTheDocument();
    expect(await screen.findByText('1.2 MB')).toBeInTheDocument();
  });

  it('гидратирует цвета блока в data-атрибуты', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([
      block(PARAGRAPH_ID, 'a0', {
        type: 'paragraph',
        content: 'Цветной текст',
        color: 'red',
        backgroundColor: 'yellow',
      }),
    ]);

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    await screen.findByText('Цветной текст');

    const paragraph = screen.getByText('Цветной текст').closest('p');

    expect(paragraph).toHaveAttribute('data-color', 'red');
    expect(paragraph).toHaveAttribute('data-background-color', 'yellow');
  });

  it('показывает подсказку и кастомный маркер в пустом пункте списка', async () => {
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');
    mockBlockResponse([block(BULLET_ID, 'a0', { type: 'bulletedListItem', content: '' })]);

    renderWithProviders(<Editor pageId={PAGE_ID} workspaceId={WORKSPACE_ID} />, gateway, {
      databases: createFakeDatabaseRepository(),
    });

    await screen.findByRole('textbox');
    await waitFor(() => {
      const emptyBlock = document.querySelector('.ProseMirror li [data-placeholder]');
      expect(emptyBlock).toHaveAttribute('data-placeholder', 'Press / for commands');
      expect(emptyBlock?.closest('li')?.querySelector('.notio-list-marker')).not.toBeNull();
    });
  });
});
