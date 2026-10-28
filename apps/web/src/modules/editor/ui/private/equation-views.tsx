'use client';

import { renderToString } from 'katex';
import 'katex/dist/katex.min.css';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * Renders LaTeX to HTML. A parse error yields null: the caller shows the raw
 * expression (as Notion shows an unparseable formula).
 */
function katexHtml(expression: string, displayMode: boolean): string | null {
  const source = expression.trim();

  if (source.length === 0) {
    return null;
  }

  try {
    return renderToString(source, {
      displayMode,
      throwOnError: true,
      strict: false,
      output: 'html',
    });
  } catch {
    return null;
  }
}

/**
 * Inline formula: an atom inside text, rendered by KaTeX. A click opens the
 * inline input (Notion behaves the same way); an empty formula pasted from the
 * slash menu opens for editing by itself.
 */
export function InlineMathView({ node, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const t = useTranslations('editor.equation');
  const expression = typeof node.attrs['expression'] === 'string' ? node.attrs['expression'] : '';
  const [editing, setEditing] = useState(expression === '');
  const [draft, setDraft] = useState(expression);
  const html = katexHtml(expression, false);

  function commit(): void {
    const next = draft.trim();

    if (next.length === 0) {
      // An empty formula is pointless: remove the node entirely.
      deleteNode();
      return;
    }

    updateAttributes({ expression: next });
    setEditing(false);
  }

  if (editing) {
    return (
      <NodeViewWrapper as="span" className="notio-inline-math is-editing">
        <input
          autoFocus
          value={draft}
          placeholder="E = mc^2"
          aria-label={t('expression')}
          onChange={(event) => setDraft(event.target.value)}
          // Keystrokes must not leak into ProseMirror under the input.
          onKeyDown={(event) => {
            event.stopPropagation();

            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              setEditing(false);
              setDraft(expression);
            }
          }}
          className="notio-inline-math-input"
        />
        <button
          type="button"
          aria-label={t('remove')}
          onClick={() => deleteNode()}
          className="notio-inline-math-remove"
        >
          ×
        </button>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="span"
      className="notio-inline-math"
      role="button"
      tabIndex={0}
      aria-label={t('label', { expression })}
      onClick={() => {
        setDraft(expression);
        setEditing(true);
      }}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          setDraft(expression);
          setEditing(true);
        }
      }}
      dangerouslySetInnerHTML={
        html
          ? { __html: html }
          : // Parse error or empty expression: the raw value, as in Notion.
            {
              __html: `<code class="notio-inline-math-raw">${
                expression.length > 0 ? escapeHtml(expression) : '\\text{…}'
              }</code>`,
            }
      }
      data-expression={expression}
    />
  );
}

/** Escapes raw LaTeX before it is inserted into innerHTML. */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Block formula: its own line with a display KaTeX render. A click puts the
 * block into editing (textarea over the render), Ctrl+Enter and Escape finish,
 * blur saves — as in Notion.
 */
export function EquationBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  const t = useTranslations('editor.equation');
  const expression = typeof node.attrs['expression'] === 'string' ? node.attrs['expression'] : '';
  const [editing, setEditing] = useState(expression === '');
  const [draft, setDraft] = useState(expression);
  const html = katexHtml(expression, true);

  function commit(): void {
    updateAttributes({ expression: draft.trim() });
    setEditing(false);
  }

  if (editing) {
    return (
      <NodeViewWrapper as="div" className="notio-equation is-editing">
        <textarea
          autoFocus
          value={draft}
          placeholder="E = mc^2"
          aria-label={t('expression')}
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();

            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              commit();
            }

            if (event.key === 'Escape') {
              event.preventDefault();
              setEditing(false);
              setDraft(expression);
            }
          }}
          onBlur={commit}
          className="notio-equation-input"
        />
        <span className="notio-equation-hint">{t('hint')}</span>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      as="div"
      className="notio-equation"
      role="button"
      tabIndex={0}
      aria-label={t('label', { expression })}
      onClick={() => {
        setDraft(expression);
        setEditing(true);
      }}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          setDraft(expression);
          setEditing(true);
        }
      }}
    >
      {html ? (
        <span dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <span className="notio-equation-raw">
          {expression.length > 0 ? expression : t('emptyBlock')}
        </span>
      )}
    </NodeViewWrapper>
  );
}
