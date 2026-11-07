import { Table, TableCell, TableHeader } from '@tiptap/extension-table';
import { Details, DetailsContent } from '@tiptap/extension-details';
import { StarterKit } from '@tiptap/starter-kit';
import { SlashMenuExtension } from '../ui/private/slash-menu-extension';
import { BlockIdAttribute, BlockIdGuard } from './extensions/block-id';
import { DropTargetHighlight } from './extensions/drop-target';
import { ListItemBlock } from './extensions/list-item';
import { TextBackgroundMark, TextColorMark } from './extensions/color-marks';
import { EmojiBlock, FileBlock, ImageBlock, VideoBlock } from './extensions/media-blocks';
import { SubPageBlock } from './extensions/sub-page-block';
import {
  ColumnsColumnBlock,
  ColumnsListBlock,
  EquationBlock,
  InlineMath,
} from './extensions/structure-blocks';
import { PageLinkBlock } from './extensions/page-blocks';
import { BreadcrumbBlock } from './extensions/breadcrumb-block';
import { DatabaseBlock, DatabaseLinkBlock } from './extensions/database-blocks';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { BlockPlaceholder, uiTaskLabel, uiToggleLabel } from './extensions/ui-placeholder';
import {
  RowResize,
  TableDomAttrs,
  TableCellFocus,
  TableRowBlock,
} from './extensions/table-extensions';
import { DetailsSummaryBlock, QuoteInput, ToggleInput } from './extensions/toggle-quote';

/**
 * The full extension set of the editor.
 *
 * The file is a barrel: the extensions themselves live in `./extensions/*`
 * grouped by domain (identity, marks, media, page links, tables, structure),
 * this file only assembles them in the required order.
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    bold: {},
    italic: {},
    strike: {},
    code: {},
    underline: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https:',
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    },
    trailingNode: false,
    listItem: false,
  }),
  TextColorMark,
  TextBackgroundMark,
  ListItemBlock,
  TaskList,
  TaskItem.configure({
    a11y: {
      checkboxLabel: (_node, checked) => uiTaskLabel(checked),
    },
  }),
  Details.configure({
    persist: true,
    openClassName: 'is-open',
    renderToggleButton: ({ element, isOpen }) => {
      element.setAttribute('aria-expanded', String(isOpen));
      element.setAttribute('aria-label', isOpen ? uiToggleLabel(false) : uiToggleLabel(true));
    },
  }),
  DetailsSummaryBlock,
  DetailsContent,
  BlockIdAttribute,
  BlockIdGuard,
  ImageBlock,
  VideoBlock,
  FileBlock,
  EmojiBlock,
  // resizable enables the official columnResizing: dragging column borders
  // and the colgroup/colwidth attributes on cells.
  Table.configure({ resizable: true }),
  TableRowBlock,
  TableHeader,
  TableCell,
  RowResize,
  TableCellFocus,
  TableDomAttrs,
  SubPageBlock,
  ColumnsListBlock,
  ColumnsColumnBlock,
  EquationBlock,
  InlineMath,
  PageLinkBlock,
  DatabaseBlock,
  DatabaseLinkBlock,
  BreadcrumbBlock,
  QuoteInput,
  ToggleInput,
  SlashMenuExtension,
  BlockPlaceholder,
  DropTargetHighlight,
];
