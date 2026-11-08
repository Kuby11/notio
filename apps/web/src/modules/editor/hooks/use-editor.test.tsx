// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { Block, BlockContent } from '@notio/contracts';
import { ContainerProvider, createContainer } from '../../../core/container';
import { gatewayStub } from '../../../../test/auth-fixture';
import type { EditorDocument, EditorNode } from '../utils/block';
import { useEditor } from './use-editor';

const PAGE_ID = '00000000-0000-4000-8000-000000000001';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000002';
const PARAGRAPH_ID = '00000000-0000-4000-8000-000000000101';
const HEADING_ID = '00000000-0000-4000-8000-000000000102';
const CREATED_ID = '00000000-0000-4000-8000-000000000103';
const SUB_PAGE_ID = '00000000-0000-4000-8000-000000000104';
const CLIENT_ID = '00000000-0000-4000-8000-0000000001ff';
const NOW = '2026-01-01T00:00:00.000Z';

interface FetchCall {
  url: string;
  method: string;
  body: unknown;
}

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

function paragraph(id: string | null, text: string): EditorNode {
  return {
    type: 'paragraph',
    attrs: { blockId: id },
    content: text.length > 0 ? [{ type: 'text', text }] : [],
  };
}

function heading(id: string | null, text: string): EditorNode {
  return {
    type: 'heading',
    attrs: { blockId: id, level: 1 },
    content: text.length > 0 ? [{ type: 'text', text }] : [],
  };
}

function documentOf(...nodes: EditorNode[]): EditorDocument {
  return { type: 'doc', content: nodes };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const SAVED: Block[] = [
  block(PARAGRAPH_ID, 'a0', { type: 'paragraph', content: 'First' }),
  block(HEADING_ID, 'a1', { type: 'heading', level: 1, content: 'Heading' }),
];

let stored: Block[];
let calls: FetchCall[];

beforeEach(() => {
  stored = [...SAVED];
  calls = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;

      calls.push({ url, method, body });

      if (method === 'GET') {
        return jsonResponse({ items: stored, nextCursor: null });
      }

      if (method === 'DELETE') {
        const id = url.split('/').pop() ?? '';
        stored = stored.filter((item) => item.id !== id);
        return new Response(null, { status: 204 });
      }

      if (method === 'POST' && url.endsWith('/api/pages')) {
        const createPageInput = body as { workspaceId: string; parentId: string | null };
        const page = {
          id: SUB_PAGE_ID,
          workspaceId: createPageInput.workspaceId,
          parentId: createPageInput.parentId,
          title: '',
          position: 'a9',
          isFavorite: false,
          isTrashed: false,
          createdBy: '00000000-0000-4000-8000-0000000000ff',
          createdAt: NOW,
          updatedAt: NOW,
        };

        return jsonResponse(page, 201);
      }

      if (method === 'POST' && url.endsWith('/api/blocks')) {
        const content = (body as { content: BlockContent }).content;
        const created = block(CREATED_ID, 'a9', content);
        stored = [...stored, created];
        return jsonResponse(created, 201);
      }

      if (method === 'POST' && url.endsWith('/move')) {
        const id = url.split('/').at(-2) ?? '';
        return jsonResponse(stored.find((item) => item.id === id));
      }

      if (method === 'PATCH') {
        const id = url.split('/').pop() ?? '';
        const current = stored.find((item) => item.id === id);
        const content = (body as { content: BlockContent }).content;
        const updated = current ? { ...current, type: content.type, content } : current;
        stored = stored.map((item) => (item.id === id && updated ? updated : item));
        return jsonResponse(updated);
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderEditorHook() {
  const gateway = gatewayStub();
  gateway.accessToken.mockResolvedValue('jwt');

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ContainerProvider container={createContainer(gateway)}>{children}</ContainerProvider>
    </QueryClientProvider>
  );

  return renderHook(() => useEditor(PAGE_ID, WORKSPACE_ID), { wrapper });
}

describe('useEditor: sub-pages', () => {
  it('creates a child page with parentId set to the current page', async () => {
    const { result } = renderEditorHook();

    await waitFor(() => expect(result.current.document.data).toHaveLength(2));

    let created: Awaited<ReturnType<typeof result.current.createSubPage.mutateAsync>> | undefined;

    await act(async () => {
      created = await result.current.createSubPage.mutateAsync();
    });

    expect(created).toMatchObject({ id: SUB_PAGE_ID, parentId: PAGE_ID, title: '' });

    const createPage = calls.find(
      (call) => call.method === 'POST' && call.url.endsWith('/api/pages'),
    );

    expect(createPage?.body).toEqual({
      workspaceId: WORKSPACE_ID,
      parentId: PAGE_ID,
      title: '',
    });
  });
});

describe('useEditor: autosave', () => {
  it('sends changes after 1000 ms and updates the status', async () => {
    const { result } = renderEditorHook();

    await waitFor(() => expect(result.current.document.data).toHaveLength(2));

    act(() => {
      result.current.autosave.schedule(
        documentOf(paragraph(PARAGRAPH_ID, 'Changed'), heading(HEADING_ID, 'Heading')),
      );
    });

    expect(calls.filter((call) => call.method !== 'GET')).toHaveLength(0);
    expect(result.current.autosave.status).toBe('pending');

    await waitFor(
      () => {
        const patch = calls.find((call) => call.method === 'PATCH');

        expect(patch?.body).toEqual({
          content: { type: 'paragraph', content: [{ text: 'Changed' }] },
        });
      },
      { timeout: 2_500 },
    );

    await waitFor(() => expect(result.current.autosave.status).toBe('saved'));
  });

  it('merges frequent changes into a single request', async () => {
    const { result } = renderEditorHook();

    await waitFor(() => expect(result.current.document.data).toHaveLength(2));

    act(() => {
      result.current.autosave.schedule(
        documentOf(paragraph(PARAGRAPH_ID, 'First edit'), heading(HEADING_ID, 'Heading')),
      );
    });

    await new Promise((resolve) => setTimeout(resolve, 300));

    act(() => {
      result.current.autosave.schedule(
        documentOf(paragraph(PARAGRAPH_ID, 'Second edit'), heading(HEADING_ID, 'Heading')),
      );
    });

    await waitFor(() => expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(1), {
      timeout: 2_500,
    });

    const [patch] = calls.filter((call) => call.method === 'PATCH');
    expect(patch?.body).toEqual({
      content: { type: 'paragraph', content: [{ text: 'Second edit' }] },
    });
  });

  it('creates a new block and puts it in its place in the document', async () => {
    const { result } = renderEditorHook();

    await waitFor(() => expect(result.current.document.data).toHaveLength(2));

    act(() => {
      result.current.autosave.schedule(
        documentOf(
          paragraph(PARAGRAPH_ID, 'First'),
          paragraph(CLIENT_ID, 'New'),
          heading(HEADING_ID, 'Heading'),
        ),
      );
    });

    await waitFor(
      () => expect(calls.filter((call) => call.url.endsWith('/move'))).toHaveLength(1),
      { timeout: 2_500 },
    );

    const create = calls.find((call) => call.method === 'POST' && call.url.endsWith('/api/blocks'));
    const move = calls.find((call) => call.url.endsWith('/move'));

    expect(create?.body).toEqual({
      pageId: PAGE_ID,
      content: { type: 'paragraph', content: [{ text: 'New' }] },
    });
    expect(move?.url).toContain(HEADING_ID);
    expect(move?.body).toEqual({ afterBlockId: CREATED_ID });
  });

  it('deletes blocks that are no longer in the document', async () => {
    const { result } = renderEditorHook();

    await waitFor(() => expect(result.current.document.data).toHaveLength(2));

    act(() => {
      result.current.autosave.schedule(documentOf(paragraph(PARAGRAPH_ID, 'First')));
    });

    await waitFor(() => expect(calls.filter((call) => call.method === 'DELETE')).toHaveLength(1), {
      timeout: 2_500,
    });

    expect(calls.find((call) => call.method === 'DELETE')?.url).toContain(HEADING_ID);
  });
});
