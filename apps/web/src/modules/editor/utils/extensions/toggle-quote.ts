import { replaceTextblockWithDetails } from '../toggle-command';
import { DetailsSummary } from '@tiptap/extension-details';
import { Extension, InputRule } from '@tiptap/react';

export const QuoteInput = Extension.create({
  name: 'quoteInput',
  priority: 101,
  addInputRules() {
    return [
      new InputRule({
        find: /^"\s$/u,
        handler: ({ chain, range }) => {
          chain().focus().deleteRange(range).setBlockquote().run();
        },
      }),
    ];
  },
});

export const DetailsSummaryBlock = DetailsSummary.extend({
  content: 'inline*',
});

export const ToggleInput = Extension.create({
  name: 'toggleInput',
  priority: 101,
  addInputRules() {
    return [
      new InputRule({
        find: /^>\s$/u,
        handler: ({ state, range }) => {
          const transaction = state.tr.delete(range.from, range.to);

          replaceTextblockWithDetails(transaction, range.from);
        },
      }),
    ];
  },
});
