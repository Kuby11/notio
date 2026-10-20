import type { Editor } from '@tiptap/react';
import { detectSlashTrigger, type SlashCommand, type SlashRange } from '../../utils/slash';
import { replaceTextblockWithToggle } from './toggle-command';

export interface EditorSlashTrigger {
  query: string;
  range: SlashRange;
}

/**
 * Находит slash-триггер в текущем выделении редактора.
 *
 * Возвращает null, если выделение не пустое, курсор не в текстовом блоке,
 * блок является кодом или текст перед курсором не похож на `/запрос`.
 * Позиции range уже абсолютные — их можно передать в `deleteRange`.
 */
export function findSlashTrigger(editor: Editor): EditorSlashTrigger | null {
  const { selection } = editor.state;

  if (!selection.empty) {
    return null;
  }

  const { $from } = selection;

  if (!$from.parent.isTextblock || $from.parent.type.name === 'codeBlock') {
    return null;
  }

  const textBeforeCursor = $from.parent.textBetween(0, $from.parentOffset, '\n', '\n');
  const trigger = detectSlashTrigger(textBeforeCursor);

  if (!trigger) {
    return null;
  }

  const blockStart = $from.start();

  return {
    query: trigger.query,
    range: {
      from: blockStart + trigger.from,
      to: blockStart + trigger.to,
    },
  };
}

/** Применяет выбранную slash-команду к текущему блоку, убирая `/запрос`. */
export function applySlashCommand(editor: Editor, command: SlashCommand, range: SlashRange) {
  const chain = editor.chain().focus().deleteRange(range);

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
      chain.setNode('toDo');
      break;
    case 'toggle':
      chain.command(({ tr }) => replaceTextblockWithToggle(tr));
      break;
  }

  chain.run();
}
