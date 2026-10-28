import { shift } from '@floating-ui/dom';
import { PluginKey } from '@tiptap/pm/state';
import { Extension, ReactRenderer } from '@tiptap/react';
import { Suggestion } from '@tiptap/suggestion';
import { applySlashCommand } from '../../utils/slash-command';
import { insertSubPageAtSlash } from '../../utils/sub-page';
import { filterSlashCommands, type SlashCommand } from '../../utils/slash';
import { SlashMenu, type SlashMenuHandle } from './slash-menu';

export const slashMenuPluginKey = new PluginKey('notioSlashMenu');

/**
 * Slash menu on the official Tiptap Suggestion utility.
 *
 * Suggestion handles the trigger, the `/` boundaries, Escape, outside clicks and
 * positioning through Floating UI. Our component is only the command list and
 * accessible keyboard navigation.
 */
export const SlashMenuExtension = Extension.create({
  name: 'notioSlashMenu',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand, SlashCommand>({
        editor: this.editor,
        pluginKey: slashMenuPluginKey,
        char: '/',
        allowSpaces: false,
        allowToIncludeChar: false,
        allowedPrefixes: [' ', '\n'],
        startOfLine: false,
        placement: 'bottom-start',
        offset: { mainAxis: 6, crossAxis: 0 },
        floatingUi: {
          strategy: 'fixed',
          middleware: [shift({ padding: 8 })],
        },
        allow: ({ editor: currentEditor, state }) => {
          // On a locked page the slash menu does not open at all.
          if (!currentEditor.isEditable) {
            return false;
          }

          const { selection } = state;

          if (!selection.empty) {
            return false;
          }

          const { $from } = selection;

          return $from.parent.isTextblock && $from.parent.type.name !== 'codeBlock';
        },
        items: ({ query }) => filterSlashCommands(query),
        command: ({ editor, range, props }) => {
          // A sub-page needs the page created asynchronously before the final
          // node is inserted — that path lives in utils/sub-page.
          if (props.kind === 'page') {
            void insertSubPageAtSlash(editor, range);
            return;
          }

          applySlashCommand(editor, props, range);
        },
        render: () => {
          let component: ReactRenderer<SlashMenuHandle> | null = null;
          let unmount: (() => void) | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                editor: props.editor,
                props: {
                  query: props.query,
                  keyboard: false,
                  onSelect: (command: SlashCommand) => props.command(command),
                },
              });
              unmount = props.mount(component.element);
            },
            onUpdate: (props) => {
              component?.updateProps({
                query: props.query,
                keyboard: false,
                onSelect: (command: SlashCommand) => props.command(command),
              });
            },
            onKeyDown: ({ event }) => component?.ref?.onKeyDown(event) ?? false,
            onExit: () => {
              unmount?.();
              component?.destroy();
              component = null;
              unmount = null;
            },
          };
        },
      }),
    ];
  },
});
