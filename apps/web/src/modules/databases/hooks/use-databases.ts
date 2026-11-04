import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type {
  CalculationType,
  CreateRowInput,
  CreateViewInput,
  Database,
  DatabaseFilter,
  DatabaseProperty,
  DatabasePropertyType,
  DatabaseRow,
  DatabaseSort,
  DatabaseView,
  PropertyValue,
  UpdateDatabaseInput,
  UpdateRowInput,
  UpdateViewInput,
} from '@notio/contracts';
import {
  calculateAggregation,
  filterRows,
  groupRows,
  moveRowBetweenGroups,
  newId,
  sortRows,
} from '@notio/contracts';
import { useContainer } from '../../../core/container';
import { databaseKeys } from '../utils/query-keys';

/**
 * Facade hook for the databases module (orchestrates server data, view filters, sorts, grouping).
 */
export function useDatabases(databaseId: string, initialViewId?: string) {
  const { databases } = useContainer();
  const queryClient = useQueryClient();

  const [activeViewId, setActiveViewId] = useState<string | null>(initialViewId ?? null);

  useEffect(() => {
    if (initialViewId) {
      setActiveViewId(initialViewId);
    }
  }, [initialViewId]);

  // Queries
  const databaseQuery = useQuery({
    queryKey: databaseKeys.detail(databaseId),
    queryFn: () => databases.get(databaseId),
    staleTime: 30_000,
  });

  const rowsQuery = useQuery({
    queryKey: databaseKeys.rows(databaseId),
    queryFn: () => databases.getRows(databaseId),
    staleTime: 10_000,
  });

  const viewsQuery = useQuery({
    queryKey: databaseKeys.views(databaseId),
    queryFn: () => databases.getViews(databaseId),
    staleTime: 30_000,
  });

  // Current active view
  const activeView = useMemo<DatabaseView | null>(() => {
    const views = viewsQuery.data ?? [];
    if (activeViewId) {
      const found = views.find((v) => v.id === activeViewId);
      if (found) return found;
    }
    return views[0] ?? null;
  }, [viewsQuery.data, activeViewId]);

  // Process rows: apply active view filters & sorts
  const processedRows = useMemo<DatabaseRow[]>(() => {
    const rawRows = rowsQuery.data ?? [];
    const properties = databaseQuery.data?.properties ?? [];
    if (!activeView) {
      return rawRows;
    }

    const filtered = filterRows(rawRows, activeView.filter, properties);
    return sortRows(filtered, activeView.sorts, properties);
  }, [rowsQuery.data, databaseQuery.data?.properties, activeView]);

  // Grouped rows for Kanban Board or grouped table
  const groups = useMemo(() => {
    const properties = databaseQuery.data?.properties ?? [];
    return groupRows(processedRows, activeView?.groupBy, properties);
  }, [processedRows, activeView?.groupBy, databaseQuery.data?.properties]);

  // Column aggregations
  const aggregations = useMemo(() => {
    const properties = databaseQuery.data?.properties ?? [];
    const aggs = activeView?.aggregations ?? [];
    const results: Record<string, number | string | null> = {};
    for (const agg of aggs) {
      results[agg.propertyId] = calculateAggregation(
        processedRows,
        agg.propertyId,
        agg.calculation,
        properties,
      );
    }
    return results;
  }, [processedRows, activeView?.aggregations, databaseQuery.data?.properties]);

  // Mutations
  const updateDatabaseMutation = useMutation({
    mutationFn: (input: UpdateDatabaseInput) => databases.update(databaseId, input),
    onSuccess: (updated) => {
      queryClient.setQueryData(databaseKeys.detail(databaseId), updated);
    },
  });

  const createRowMutation = useMutation({
    mutationFn: (input: Omit<CreateRowInput, 'databaseId'>) =>
      databases.createRow({ ...input, databaseId }),
    onSuccess: (newRow) => {
      queryClient.setQueryData<DatabaseRow[]>(databaseKeys.rows(databaseId), (old = []) => [
        ...old,
        newRow,
      ]);
    },
  });

  const updateRowMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRowInput }) =>
      databases.updateRow(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: databaseKeys.rows(databaseId) });
      const previousRows = queryClient.getQueryData<DatabaseRow[]>(databaseKeys.rows(databaseId));

      queryClient.setQueryData<DatabaseRow[]>(databaseKeys.rows(databaseId), (old = []) =>
        old.map((r) =>
          r.id === id
            ? {
                ...r,
                title: input.title !== undefined ? input.title : r.title,
                properties:
                  input.properties !== undefined
                    ? { ...r.properties, ...input.properties }
                    : r.properties,
              }
            : r,
        ),
      );

      return { previousRows };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousRows) {
        queryClient.setQueryData(databaseKeys.rows(databaseId), context.previousRows);
      }
    },
    onSuccess: (updatedRow) => {
      queryClient.setQueryData<DatabaseRow[]>(databaseKeys.rows(databaseId), (old = []) =>
        old.map((r) => (r.id === updatedRow.id ? updatedRow : r)),
      );
    },
  });

  const deleteRowMutation = useMutation({
    mutationFn: (id: string) => databases.deleteRow(id),
    onSuccess: (_, deletedId) => {
      queryClient.setQueryData<DatabaseRow[]>(databaseKeys.rows(databaseId), (old = []) =>
        old.filter((r) => r.id !== deletedId),
      );
    },
  });

  const createViewMutation = useMutation({
    mutationFn: (input: Omit<CreateViewInput, 'databaseId'>) =>
      databases.createView({ ...input, databaseId }),
    onSuccess: (newView) => {
      queryClient.setQueryData<DatabaseView[]>(databaseKeys.views(databaseId), (old = []) => [
        ...old,
        newView,
      ]);
      setActiveViewId(newView.id);
    },
  });

  const updateViewMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateViewInput }) =>
      databases.updateView(id, input),
    onSuccess: (updatedView) => {
      queryClient.setQueryData<DatabaseView[]>(databaseKeys.views(databaseId), (old = []) =>
        old.map((v) => (v.id === updatedView.id ? updatedView : v)),
      );
    },
  });

  /** Duplicates a view's configuration under a new name and opens the copy. */
  const duplicateView = async (source: DatabaseView, name: string) => {
    const created = await databases.createView({
      databaseId,
      name,
      type: source.type,
      filter: source.filter,
      sorts: source.sorts,
      groupBy: source.groupBy,
      chart: source.chart,
      visiblePropertyIds: source.visiblePropertyIds,
    });

    queryClient.setQueryData<DatabaseView[]>(databaseKeys.views(databaseId), (old = []) => [
      ...old,
      created,
    ]);
    setActiveViewId(created.id);
  };

  /** Deletes a view; the last remaining view is kept so there is always a way back. */
  const deleteView = async (viewId: string) => {
    const current = viewsQuery.data ?? [];

    if (current.length <= 1) {
      return;
    }

    await databases.deleteView(viewId);

    const remaining = current.filter((view) => view.id !== viewId);

    queryClient.setQueryData<DatabaseView[]>(databaseKeys.views(databaseId), remaining);

    if (activeViewId === viewId) {
      setActiveViewId(remaining[0]?.id ?? null);
    }
  };

  // Action helpers
  // Property management updates the database schema and every view's
  // visibility/ordering in step: a property that is added to the database but
  // missing from visiblePropertyIds would stay invisible in a configured view.
  const updateDatabaseRecord = (updated: Database) => {
    queryClient.setQueryData(databaseKeys.detail(databaseId), updated);
  };

  const updateViewRecord = (updatedView: DatabaseView) => {
    queryClient.setQueryData<DatabaseView[]>(databaseKeys.views(databaseId), (old = []) =>
      old.map((view) => (view.id === updatedView.id ? updatedView : view)),
    );
  };

  /**
   * Latest schema from the cache, not from the render closure: two property
   * actions fired in the same tick (a name blur followed by "change type") must
   * compose instead of overwriting each other.
   */
  const readDatabase = (): Database | undefined =>
    queryClient.getQueryData<Database>(databaseKeys.detail(databaseId)) ?? databaseQuery.data;

  /** Optimistically replaces the schema, then confirms it with the repository. */
  const saveProperties = async (properties: DatabaseProperty[]) => {
    const current = readDatabase();

    if (!current) {
      return;
    }

    updateDatabaseRecord({ ...current, properties, updatedAt: new Date().toISOString() });
    updateDatabaseRecord(await databases.update(databaseId, { properties }));
  };

  const addProperty = async (input: { name: string; type: DatabasePropertyType }) => {
    const current = readDatabase();

    if (!current) {
      return;
    }

    const property: DatabaseProperty = { id: newId(), name: input.name, type: input.type };

    await saveProperties([...current.properties, property]);

    for (const view of viewsQuery.data ?? []) {
      // An empty list means "show every property": the new one is visible already.
      if (view.visiblePropertyIds.length === 0) {
        continue;
      }

      updateViewRecord(
        await databases.updateView(view.id, {
          visiblePropertyIds: [...view.visiblePropertyIds, property.id],
        }),
      );
    }
  };

  const updateProperty = async (
    propertyId: string,
    input: { name?: string; type?: DatabasePropertyType },
  ) => {
    const current = readDatabase();

    if (!current) {
      return;
    }

    const property = current.properties.find((item) => item.id === propertyId);

    if (!property) {
      return;
    }

    const name = input.name?.trim();
    const type = input.type ?? property.type;
    const next: DatabaseProperty =
      type === property.type
        ? { ...property, ...(name && name.length > 0 ? { name } : {}) }
        : {
            // Configuration of the old type is meaningless for the new one.
            id: property.id,
            name: name && name.length > 0 ? name : property.name,
            type,
            ...(property.description ? { description: property.description } : {}),
          };

    await saveProperties(current.properties.map((item) => (item.id === propertyId ? next : item)));
  };

  const deleteProperty = async (propertyId: string) => {
    const current = readDatabase();
    const property = current?.properties.find((item) => item.id === propertyId);

    // The title property is the identity of a row: it cannot be removed.
    if (!current || !property || property.type === 'title') {
      return;
    }

    await saveProperties(current.properties.filter((item) => item.id !== propertyId));

    for (const view of viewsQuery.data ?? []) {
      const columnWidths = view.columnWidths ? { ...view.columnWidths } : null;

      if (columnWidths) {
        delete columnWidths[propertyId];
      }

      updateViewRecord(
        await databases.updateView(view.id, {
          visiblePropertyIds: view.visiblePropertyIds.filter((id) => id !== propertyId),
          ...(view.aggregations
            ? { aggregations: view.aggregations.filter((item) => item.propertyId !== propertyId) }
            : {}),
          ...(columnWidths ? { columnWidths } : {}),
          ...(view.groupBy?.propertyId === propertyId ? { groupBy: null } : {}),
          ...(view.sorts.some((sort) => sort.propertyId === propertyId)
            ? { sorts: view.sorts.filter((sort) => sort.propertyId !== propertyId) }
            : {}),
        }),
      );
    }
  };

  const duplicateProperty = async (propertyId: string, name: string) => {
    const current = readDatabase();
    const index = current?.properties.findIndex((item) => item.id === propertyId) ?? -1;
    const source = current?.properties[index];

    if (!current || !source || source.type === 'title') {
      return;
    }

    const copy: DatabaseProperty = { ...source, id: newId(), name };
    const properties = [...current.properties];

    properties.splice(index + 1, 0, copy);
    await saveProperties(properties);

    for (const view of viewsQuery.data ?? []) {
      const position = view.visiblePropertyIds.indexOf(propertyId);

      if (position === -1) {
        continue;
      }

      const visiblePropertyIds = [...view.visiblePropertyIds];

      visiblePropertyIds.splice(position + 1, 0, copy.id);
      updateViewRecord(await databases.updateView(view.id, { visiblePropertyIds }));
    }
  };

  const hideProperty = async (propertyId: string) => {
    const current = readDatabase();

    if (!current || !activeView) {
      return;
    }

    // An empty list means "every property": hiding one materialises the rest.
    const visiblePropertyIds =
      activeView.visiblePropertyIds.length === 0
        ? current.properties.map((item) => item.id).filter((id) => id !== propertyId)
        : activeView.visiblePropertyIds.filter((id) => id !== propertyId);

    updateViewRecord(await databases.updateView(activeView.id, { visiblePropertyIds }));
  };

  const showProperty = async (propertyId: string) => {
    if (
      !activeView ||
      activeView.visiblePropertyIds.length === 0 ||
      activeView.visiblePropertyIds.includes(propertyId)
    ) {
      return;
    }

    updateViewRecord(
      await databases.updateView(activeView.id, {
        visiblePropertyIds: [...activeView.visiblePropertyIds, propertyId],
      }),
    );
  };

  const moveCard = (row: DatabaseRow, targetGroupId: string) => {
    if (!activeView?.groupBy) return;
    const updatedProps = moveRowBetweenGroups(row, activeView.groupBy, targetGroupId);
    updateRowMutation.mutate({
      id: row.id,
      input: { properties: updatedProps },
    });
  };

  const updateCell = (row: DatabaseRow, propertyId: string, value: PropertyValue | null) => {
    if (propertyId === 'title') {
      updateRowMutation.mutate({
        id: row.id,
        input: { title: String(value ?? '') },
      });
    } else {
      updateRowMutation.mutate({
        id: row.id,
        input: {
          properties: {
            ...row.properties,
            [propertyId]: value,
          },
        },
      });
    }
  };

  const setViewFilter = (filter: DatabaseFilter | null) => {
    if (!activeView) return;
    updateViewMutation.mutate({
      id: activeView.id,
      input: { filter },
    });
  };

  const setViewSorts = (sorts: DatabaseSort[]) => {
    if (!activeView) return;
    updateViewMutation.mutate({
      id: activeView.id,
      input: { sorts },
    });
  };

  const setViewAggregation = (propertyId: string, calculation: CalculationType) => {
    if (!activeView) return;
    const existing = (activeView.aggregations ?? []).filter((a) => a.propertyId !== propertyId);
    existing.push({ propertyId, calculation });
    updateViewMutation.mutate({
      id: activeView.id,
      input: { aggregations: existing },
    });
  };

  return {
    database: databaseQuery.data,
    rows: processedRows,
    rawRows: rowsQuery.data ?? [],
    views: viewsQuery.data ?? [],
    activeView,
    groups,
    aggregations,
    isLoading: databaseQuery.isLoading || rowsQuery.isLoading || viewsQuery.isLoading,
    isError: databaseQuery.isError || rowsQuery.isError || viewsQuery.isError,
    setActiveViewId,
    createRow: (title?: string, properties?: Record<string, PropertyValue | null>) =>
      createRowMutation.mutate({ title: title ?? 'New page', properties }),
    updateRow: updateRowMutation.mutate,
    deleteRow: deleteRowMutation.mutate,
    createView: createViewMutation.mutate,
    updateView: updateViewMutation.mutate,
    duplicateView,
    deleteView,
    updateCell,
    moveCard,
    setViewFilter,
    setViewSorts,
    setViewAggregation,
    updateDatabase: updateDatabaseMutation.mutate,
    addProperty,
    updateProperty,
    deleteProperty,
    duplicateProperty,
    hideProperty,
    showProperty,
  };
}

/**
 * Views of one database for the sidebar tree. Like page children, the query
 * is enabled only for an expanded branch; the database's defaultViewId is
 * enough to know that the expand control belongs on the row.
 */
export function useDatabaseViews(databaseId: string, enabled = true) {
  const { databases } = useContainer();

  return useQuery({
    queryKey: databaseKeys.views(databaseId),
    queryFn: () => databases.getViews(databaseId),
    staleTime: 30_000,
    enabled,
  });
}

/**
 * Databases of a workspace: the list for the sidebar tree plus creation and
 * soft deletion (isTrashed). Separate from the single-database hook because the
 * tree renders outside any open database.
 */
export function useWorkspaceDatabases(workspaceId: string) {
  const { databases } = useContainer();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: databaseKeys.list(workspaceId),
    queryFn: () => databases.list(workspaceId),
    staleTime: 30_000,
  });

  const createDatabase = useMutation({
    mutationFn: (title: string) =>
      databases.create({ workspaceId, parentId: null, title, isInline: false }),
    onSuccess: (created) => {
      queryClient.setQueryData<Database[]>(databaseKeys.list(workspaceId), (old = []) => [
        ...old,
        created,
      ]);
    },
  });

  const deleteDatabase = useMutation({
    mutationFn: (id: string) => databases.update(id, { isTrashed: true }),
    onSuccess: (deleted) => {
      queryClient.setQueryData<Database[]>(databaseKeys.list(workspaceId), (old = []) =>
        (old ?? []).filter((item) => item.id !== deleted.id),
      );
    },
  });

  return {
    items: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    createDatabase,
    deleteDatabase,
  };
}
