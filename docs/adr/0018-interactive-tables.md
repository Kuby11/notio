# ADR 0018. Interactive tables: geometry, controls and reordering

- **Status:** accepted
- **Date:** 2026-10-24

## Context

After ADR 0016 the table could only insert and edit text. Notion sets the expectation of dragging
column and row borders, adding rows/columns to an existing table, a visible cell focus and moving
whole rows/columns.

Constraints:

- `prosemirror-tables` provides `columnResizing` (columns) and add/delete commands, but cannot
  change row height or reorder rows/columns (this version has no moveRow/moveColumn);
- with `resizable: true` the table is rendered by the columnResizing plugin's internal TableView —
  which does not apply node attrs, including `data-block-id`;
- the table's BlockContent stored only cell text — geometry was lost on reload.

## Decision

- **Column widths use the official columnResizing** (`Table.configure({ resizable: true })`):
  dragging vertical borders, colgroup, a `colwidth` attr on cells. `lastColumnResizable` distributes
  the empty space on the right.
- **Row heights use a custom RowResize plugin**: a 4px grab zone at the row's bottom border; during
  the drag the DOM is edited directly, and on mouseup a single transaction commits the `rowHeight`
  attr on `tableRow` (the TableRowBlock extension). That keeps undo history to one step.
- **Geometry is serialised**: `TableBlockContent` gained optional `colWidths` (per column, from the
  `colwidth` of the first row's cells) and `rowHeights` (per row); null means automatic size. The
  arrays are written only when at least one value is set.
- **Cell focus is a decoration**: the TableCellFocus plugin uses cellAround to put the
  `notio-active-cell` class on the cell with the cursor; CSS draws an outline. A selected cell range
  is highlighted by the official `.selectedCell` (also with an outline).
- **Controls are the TableControls overlay**: when the cursor is in a table, pills appear at the
  column header and left of the row: add (row below/column right), delete (the official deleteRow/
  deleteColumn) and a drag handle.
- **Reordering uses HTML5 drag with an indicator**: dragging the pill's handle shows an insertion
  line (dragover computes the index from half of the cell under the cursor), and the drop calls
  `moveTableRow`/`moveTableColumn`. The reorder commands are custom: the table is rebuilt in a single
  transaction, and cell and row attrs move with them.
- **A `data-block-id` on the table** is restored by the TableDomAttrs plugin after every step: it
  finds the table's DOM (nodeDOM for a table with a node view returns the tableWrapper) and copies
  the attr from the node.

## Alternatives

- **A custom node view for the table** instead of syncing attrs: more control, but duplicates
  columnResizing and its colgroup logic.
- **A transaction per mousemove while resizing rows**: simpler code, but worse undo history and
  performance; DOM edits plus one commit give the same result more cheaply.
- **Arrows/menu instead of drag for reordering**: cheaper to implement, but the user explicitly asked
  for dragging.

## Consequences

- Minimum width/height is 20/24px: protection against cells collapsing.
- Dragging a row/column handle works within one table; moving between tables is not supported.
- Geometry is in pixels; proportions are not recomputed on other devices (as in Notion with fixed
  tables).
- The overlay is positioned from the DOM on every transaction/scroll — pills follow the table while
  scrolling.
