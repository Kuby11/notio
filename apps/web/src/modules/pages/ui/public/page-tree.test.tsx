// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page } from '@notio/contracts';
import { gatewayStub, renderWithProviders } from '../../../../../test/auth-fixture';
import { PageTree } from './page-tree';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000010';
const ROOT_ID = '00000000-0000-4000-8000-000000000101';
const LEAF_ID = '00000000-0000-4000-8000-000000000102';
const CHILD_ID = '00000000-0000-4000-8000-000000000103';
const NOW = '2026-01-01T00:00:00.000Z';

function page(overrides: Partial<Page> & Pick<Page, 'id' | 'title' | 'position'>): Page {
  return {
    workspaceId: WORKSPACE_ID,
    parentId: null,
    isFavorite: false,
    isTrashed: false,
    createdBy: USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const ROOT = page({ id: ROOT_ID, title: 'Корень', position: 'a0' });
const LEAF = page({ id: LEAF_ID, title: 'Лист', position: 'a1' });
const CHILD = page({ id: CHILD_ID, title: 'Вложенная', parentId: ROOT_ID, position: 'a0' });

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      const parentId = url.searchParams.get('parentId');
      const items = parentId === ROOT_ID ? [CHILD] : parentId === null ? [ROOT, LEAF] : [];

      return new Response(JSON.stringify({ items, nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PageTree', () => {
  it('ведёт на страницу, а вложенность раскрывает отдельной кнопкой', async () => {
    const user = userEvent.setup();
    const gateway = gatewayStub();
    gateway.accessToken.mockResolvedValue('jwt');

    renderWithProviders(<PageTree workspaceId={WORKSPACE_ID} />, gateway);

    expect(await screen.findByRole('link', { name: /Корень/ })).toHaveAttribute(
      'href',
      `/workspaces/${WORKSPACE_ID}/${ROOT_ID}`,
    );
    expect(screen.getByRole('link', { name: /Лист/ })).toHaveAttribute(
      'href',
      `/workspaces/${WORKSPACE_ID}/${LEAF_ID}`,
    );

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Развернуть «Лист»' })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole('button', { name: 'Развернуть «Корень»' }));

    expect(await screen.findByRole('link', { name: /Вложенная/ })).toHaveAttribute(
      'href',
      `/workspaces/${WORKSPACE_ID}/${CHILD_ID}`,
    );
    expect(screen.getByRole('button', { name: 'Свернуть «Корень»' })).toBeInTheDocument();
  });
});
