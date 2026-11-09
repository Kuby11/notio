import type { DatabaseProperty, DatabaseRow, DatabaseView, RowGroup } from '@notio/contracts';
import { PropertyBadge } from './property-badge';
import { Button } from '../../../../shared/ui/button';

export interface BoardViewProps {
  properties: DatabaseProperty[];
  groups: RowGroup[];
  view: DatabaseView;
  onCardMove: (row: DatabaseRow, targetGroupId: string) => void;
  onAddCard: (targetGroupId: string) => void;
  onDeleteRow: (rowId: string) => void;
  /** Opens the row popover, where its data can be edited. */
  onOpenRow?: (row: DatabaseRow) => void;
}

export function BoardView({
  properties,
  groups,
  view,
  onCardMove,
  onAddCard,
  onDeleteRow,
  onOpenRow,
}: BoardViewProps) {
  const visibleProps =
    view.visiblePropertyIds && view.visiblePropertyIds.length > 0
      ? properties.filter((p) => p.type !== 'title' && view.visiblePropertyIds.includes(p.id))
      : properties.filter((p) => p.type !== 'title');

  return (
    <div className="flex gap-4 overflow-x-auto p-4 items-start min-h-[400px]">
      {groups.map((group) => (
        <div
          key={group.id}
          className="w-72 shrink-0 rounded-xl bg-muted/30 border border-border/50 flex flex-col max-h-[calc(100vh-220px)]"
        >
          {/* Column Header */}
          <div className="flex items-center justify-between p-3 border-b border-border/40">
            <div className="flex items-center gap-2">
              <PropertyBadge label={group.name} color={group.color} />
              <span className="text-xs text-muted-foreground font-mono">{group.rows.length}</span>
            </div>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onAddCard(group.id)}
              title="Add card"
            >
              +
            </Button>
          </div>

          {/* Cards Container */}
          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {group.rows.map((row) => (
              <div
                key={row.id}
                className="group relative rounded-lg border border-border bg-card p-3 shadow-xs hover:shadow-md transition-shadow"
              >
                {/* The title opens the row popover: a board card shows its data,
                    editing happens in the popover. */}
                <button
                  type="button"
                  onClick={() => onOpenRow?.(row)}
                  className="font-medium text-sm text-foreground truncate text-left w-full pr-6 hover:underline"
                >
                  {row.title || 'Untitled'}
                </button>

                {/* Additional Visible Properties */}
                {visibleProps.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 items-center">
                    {visibleProps.map((prop) => {
                      const val = row.properties[prop.id];
                      if (val === null || val === undefined || val === '') return null;

                      if (prop.type === 'select') {
                        const opt = prop.selectConfig?.options?.find((o) => o.id === val);
                        return opt ? (
                          <PropertyBadge key={prop.id} label={opt.name} color={opt.color} />
                        ) : null;
                      }

                      if (prop.type === 'date') {
                        const d =
                          typeof val === 'object' && 'start' in val
                            ? (val as { start: string }).start
                            : String(val);
                        return (
                          <span
                            key={prop.id}
                            className="text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded"
                          >
                            📅 {d}
                          </span>
                        );
                      }

                      if (prop.type === 'checkbox') {
                        return (
                          <span
                            key={prop.id}
                            className="text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded"
                          >
                            {val ? '✓' : '✗'} {prop.name}
                          </span>
                        );
                      }

                      return (
                        <span
                          key={prop.id}
                          className="text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded truncate max-w-[140px]"
                        >
                          {String(val)}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Move card quick selector */}
                <div className="mt-3 pt-2 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="text-[10px] uppercase">Move to:</span>
                  <select
                    value={group.id}
                    onChange={(e) => onCardMove(row, e.target.value)}
                    className="text-xs bg-muted/50 rounded px-1.5 py-0.5 border-none outline-none cursor-pointer max-w-[120px]"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Delete button on hover */}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onDeleteRow(row.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive/10"
                  title="Delete card"
                >
                  ✕
                </Button>
              </div>
            ))}

            {group.rows.length === 0 && (
              <div className="text-center py-6 text-xs text-muted-foreground/50 italic border-dashed border border-border/40 rounded-lg">
                No cards
              </div>
            )}
          </div>

          {/* Add card footer */}
          <div className="p-2 border-t border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddCard(group.id)}
              className="w-full justify-start text-xs text-muted-foreground hover:text-foreground h-7"
            >
              + New card
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
