// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { ContainerProvider, createContainer } from '../../../core/container';
import { gatewayStub } from '../../../../test/auth-fixture';
import { createFakeDatabaseRepository } from '../../../../test/database-fixture';
import type { Database } from '@notio/contracts';
import { useDatabases } from './use-databases';
import { useWorkspaceDatabases } from './use-workspace-databases';

const DB_ID = 'db-test-123';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000020';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const container = createContainer(gatewayStub(), {
    databases: createFakeDatabaseRepository(),
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ContainerProvider container={container}>{children}</ContainerProvider>
      </QueryClientProvider>
    );
  };
}

describe('useDatabases facade hook', () => {
  it('загружает базу данных, строки и представления по умолчанию', async () => {
    const { result } = renderHook(() => useDatabases(DB_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.database).toBeDefined();
    });

    expect(result.current.database?.title).toBe('Project Tasks');
    expect(result.current.views.length).toBeGreaterThanOrEqual(2);
    expect(result.current.rows.length).toBeGreaterThanOrEqual(3);
    expect(result.current.activeView?.type).toBe('table');
  });

  it('переключает активное представление между Table и Board', async () => {
    const { result } = renderHook(() => useDatabases(DB_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.views.length).toBeGreaterThanOrEqual(2);
    });

    const boardView = result.current.views.find((v) => v.type === 'board');
    expect(boardView).toBeDefined();

    act(() => {
      result.current.setActiveViewId(boardView!.id);
    });

    expect(result.current.activeView?.id).toBe(boardView!.id);
    expect(result.current.activeView?.type).toBe('board');
    expect(result.current.groups.length).toBeGreaterThan(0);
  });

  it('создаёт новую строку в базе данных', async () => {
    const { result } = renderHook(() => useDatabases(DB_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.database).toBeDefined();
    });

    const initialCount = result.current.rows.length;

    act(() => {
      result.current.createRow('Deploy to Cloudflare');
    });

    await waitFor(() => {
      expect(result.current.rows.length).toBe(initialCount + 1);
    });

    expect(result.current.rows.some((r) => r.title === 'Deploy to Cloudflare')).toBe(true);
  });

  it('обновляет значение ячейки в строке', async () => {
    const { result } = renderHook(() => useDatabases(DB_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.database).toBeDefined();
      expect(result.current.activeView).toBeDefined();
      expect(result.current.rows.length).toBeGreaterThan(0);
    });

    const targetRow = result.current.rows[0]!;

    act(() => {
      result.current.updateCell(targetRow, 'title', 'Updated Task Name');
    });

    await waitFor(() => {
      const updated = result.current.rows.find((r) => r.id === targetRow.id);
      expect(updated?.title).toBe('Updated Task Name');
    });
  });

  it('создаёт, переименовывает, скрывает, дублирует и удаляет свойство', async () => {
    const { result } = renderHook(() => useDatabases(DB_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.database).toBeDefined();
    });

    await act(async () => {
      await result.current.addProperty({ name: 'Estimate', type: 'number' });
    });

    await waitFor(() => {
      expect(result.current.database?.properties.some((p) => p.name === 'Estimate')).toBe(true);
    });

    const property = result.current.database!.properties.find((p) => p.name === 'Estimate')!;
    const table = result.current.views.find((view) => view.type === 'table');

    expect(table?.visiblePropertyIds).toContain(property.id);

    await act(async () => {
      await result.current.updateProperty(property.id, { name: 'Effort', type: 'text' });
    });

    await waitFor(() => {
      const updated = result.current.database?.properties.find((p) => p.id === property.id);
      expect(updated?.name).toBe('Effort');
      expect(updated?.type).toBe('text');
    });

    await act(async () => {
      await result.current.hideProperty(property.id);
    });

    await waitFor(() => {
      expect(result.current.activeView?.visiblePropertyIds).not.toContain(property.id);
    });

    await act(async () => {
      await result.current.showProperty(property.id);
    });

    await waitFor(() => {
      expect(result.current.activeView?.visiblePropertyIds).toContain(property.id);
    });

    await act(async () => {
      await result.current.duplicateProperty(property.id, 'Effort copy');
    });

    await waitFor(() => {
      expect(result.current.database?.properties.some((p) => p.name === 'Effort copy')).toBe(true);
    });

    await act(async () => {
      await result.current.deleteProperty(property.id);
    });

    await waitFor(() => {
      expect(result.current.database?.properties.some((p) => p.id === property.id)).toBe(false);
    });
  });

  it('перемещает карточку в другую колонку канбана', async () => {
    const { result } = renderHook(() => useDatabases(DB_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.views.length).toBeGreaterThan(1);
    });

    const boardView = result.current.views.find((v) => v.type === 'board');
    act(() => {
      result.current.setActiveViewId(boardView!.id);
    });

    const targetRow = result.current.rows[0]!;

    act(() => {
      result.current.moveCard(targetRow, 'done');
    });

    await waitFor(() => {
      const updated = result.current.rows.find((r) => r.id === targetRow.id);
      expect(updated?.properties['status']).toBe('done');
    });
  });
});

describe('useWorkspaceDatabases facade hook', () => {
  it('создаёт и удаляет базу данных рабочего пространства', async () => {
    const { result } = renderHook(() => useWorkspaceDatabases(WORKSPACE_ID), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let created: Database | undefined;

    await act(async () => {
      created = await result.current.createDatabase.mutateAsync('Planning');
    });

    await waitFor(() => {
      expect(result.current.items.some((item) => item.id === created?.id)).toBe(true);
    });

    await act(async () => {
      await result.current.deleteDatabase.mutateAsync(created!.id);
    });

    await waitFor(() => {
      expect(result.current.items.some((item) => item.id === created?.id)).toBe(false);
    });
  });
});
