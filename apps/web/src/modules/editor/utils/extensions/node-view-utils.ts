import type { ComponentType } from 'react';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';

/**
 * React node view with an editable wrapper.
 *
 * PM sets contenteditable=false on contentless atomic node views, which makes
 * the browser's caret logic skip the area entirely and always return a position
 * AFTER the block: DragHandle cannot find an atomic media block (and with a
 * neighbour would aim at it instead). An attribute set before PM's check (it
 * respects an existing one) keeps the caret inside the wrapper — the left half
 * of the block gives "before", the right half "after".
 */
export function editableReactNodeView(component: ComponentType<ReactNodeViewProps>) {
  return (props: Parameters<ReturnType<typeof ReactNodeViewRenderer>>[0]) => {
    const view = ReactNodeViewRenderer(component)(props);

    view.dom.setAttribute('contenteditable', 'true');

    return view;
  };
}
