import type { Editor } from '@tiptap/react';
import type { SlashCommand, SlashRange } from './slash';
import { replaceTextblockWithDetails } from './toggle-command';

/**
 * Applies the selected slash command to the current block, removing the `/query`.
 *
 * For commands that change the line type, the list item is lifted out
 * of listItem/taskItem first: otherwise Details or a heading would end up
 * inside the list and be lost when serialising BlockContent. The `page`
 * command does not come through here: a sub-page is created asynchronously (see utils/sub-page).
 *
 * kind and headingLevel are enough: the turn-into menu passes a
 * synthetic command without menu data.
 */
export function applySlashCommand(
  editor: Editor,
  command: Pick<SlashCommand, 'kind' | 'headingLevel' | 'columnsCount'>,
  range: SlashRange,
) {
  const chain = editor.chain().focus().deleteRange(range);
  const leavesList =
    command.kind === 'paragraph' ||
    command.kind === 'heading' ||
    command.kind === 'toggle' ||
    command.kind === 'quote' ||
    command.kind === 'divider' ||
    command.kind === 'table' ||
    command.kind === 'page' ||
    command.kind === 'code' ||
    command.kind === 'image' ||
    command.kind === 'video' ||
    command.kind === 'file' ||
    command.kind === 'emoji' ||
    command.kind === 'columns' ||
    command.kind === 'equation' ||
    command.kind === 'inlineEquation' ||
    command.kind === 'linkToPage' ||
    command.kind === 'breadcrumb' ||
    command.kind === 'database' ||
    command.kind === 'databasePage' ||
    command.kind === 'chart';

  if (leavesList) {
    if (editor.isActive('taskItem')) {
      chain.liftListItem('taskItem');
    } else if (editor.isActive('listItem')) {
      chain.liftListItem('listItem');
    }
  }

  switch (command.kind) {
    case 'paragraph':
      chain.setParagraph();
      break;
    case 'heading':
      chain.setHeading({ level: command.headingLevel ?? 1 });
      break;
    case 'bulletList':
      chain.toggleBulletList();
      break;
    case 'orderedList':
      chain.toggleOrderedList();
      break;
    case 'toDo':
      chain.toggleTaskList();
      break;
    case 'toggle':
      chain.command(({ tr }) => replaceTextblockWithDetails(tr));
      break;
    case 'quote':
      chain.setBlockquote();
      break;
    case 'divider':
      chain.setHorizontalRule();
      break;
    case 'table':
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
      break;
    case 'code':
      chain.setCodeBlock();
      break;
    case 'image':
      chain.insertContent({ type: 'image' });
      break;
    case 'video':
      chain.insertContent({ type: 'video' });
      break;
    case 'file':
      chain.insertContent({ type: 'file' });
      break;
    case 'emoji':
      chain.insertContent({ type: 'emoji' });
      break;
    case 'columns': {
      const count = command.columnsCount ?? 2;
      const columns = Array.from({ length: count }, () => ({
        type: 'columnsColumn',
        content: [{ type: 'paragraph' }],
      }));

      chain.insertContent({ type: 'columnsList', content: columns });
      break;
    }
    case 'equation':
      chain.insertContent({ type: 'equationBlock', attrs: { expression: '' } });
      break;
    case 'inlineEquation':
      chain.insertContent({ type: 'inlineMath', attrs: { expression: '' } });
      break;
    case 'linkToPage':
      chain.insertContent({ type: 'pageLink', attrs: { pageId: '' } });
      break;
    case 'breadcrumb':
      chain.insertContent({ type: 'breadcrumbBlock' });
      break;
    case 'page':
    case 'database':
    case 'databasePage':
    case 'chart':
      // Created asynchronously: the node is inserted by utils/sub-page and
      // utils/database-block once the service responds.
      break;
  }

  chain.run();
}
