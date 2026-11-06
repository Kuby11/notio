// @vitest-environment jsdom
import { Editor, type AnyExtension } from '@tiptap/react';
import { afterEach, describe, expect, it } from 'vitest';
import { editorExtensions } from './editor-extensions';

const EXTENSIONS: AnyExtension[] = editorExtensions.map((extension) =>
  extension.name === 'starterKit' ? extension.configure({ dropcursor: false }) : extension,
);

let editor: Editor | null = null;

function createEditor(content: unknown): Editor {
  editor = new Editor({ extensions: EXTENSIONS, content: content as never });

  return editor;
}

function paragraph(text = ''): unknown {
  return {
    type: 'paragraph',
    content: text.length > 0 ? [{ type: 'text', text }] : undefined,
  };
}

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.documentElement.lang = '';
});

describe('media blocks: renderHTML fallbacks', () => {
  it('renders an uploaded image with caption and percentage width', () => {
    const current = createEditor({
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { fileId: 'file-1', caption: 'Chart', width: 50 },
        },
      ],
    });

    const html = current.getHTML();

    expect(html).toContain('data-block-type="image"');
    expect(html).toContain('src="/api/media/files/file-1"');
    expect(html).toContain('alt="Chart"');
    expect(html).toContain('data-width="50"');
    expect(html).toContain('width: 50%');
    expect(html).toContain('<figcaption>Chart</figcaption>');
  });

  it('renders an external image in full width without a width style', () => {
    const current = createEditor({
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { url: 'https://example.com/a.png', caption: '', width: 80, fullWidth: true },
        },
      ],
    });

    const html = current.getHTML();

    expect(html).toContain('src="https://example.com/a.png"');
    expect(html).toContain('data-full-width="true"');
    expect(html).toContain('alt="Image"');
    expect(html).not.toContain('width: 80%');
  });

  it('renders a placeholder for an image without a source', () => {
    const current = createEditor({ type: 'doc', content: [{ type: 'image' }] });

    const html = current.getHTML();

    expect(html).toContain('data-full-width="false"');
    expect(html).toContain('<span>Image</span>');
    expect(html).not.toContain('<img');
  });

  it('renders video from a file id and from a link', () => {
    const uploaded = createEditor({
      type: 'doc',
      content: [{ type: 'video', attrs: { fileId: 'video-1', caption: 'Demo' } }],
    });
    expect(uploaded.getHTML()).toContain('src="/api/media/files/video-1"');
    expect(uploaded.getHTML()).toContain('alt="Demo"');

    const linked = createEditor({
      type: 'doc',
      content: [{ type: 'video', attrs: { url: 'https://example.com/v.mp4' } }],
    });
    expect(linked.getHTML()).toContain('data-block-type="video"');
    expect(linked.getHTML()).toContain('src="https://example.com/v.mp4"');
    expect(linked.getHTML()).toContain('alt="Video"');

    const empty = createEditor({ type: 'doc', content: [{ type: 'video' }] });
    expect(empty.getHTML()).toContain('<span>Video</span>');
  });

  it('renders a file row with its name and falls back to a default', () => {
    const named = createEditor({
      type: 'doc',
      content: [{ type: 'file', attrs: { fileId: 'file-2', name: 'report.pdf', sizeBytes: 2048 } }],
    });
    expect(named.getHTML()).toContain('report.pdf');
    expect(named.getHTML()).toContain('data-name="report.pdf"');

    const unnamed = createEditor({ type: 'doc', content: [{ type: 'file' }] });
    expect(unnamed.getHTML()).toContain('notio-file-name');
    expect(unnamed.getHTML()).toContain('File');
  });

  it('renders an emoji block with a default', () => {
    const custom = createEditor({
      type: 'doc',
      content: [{ type: 'emoji', attrs: { emoji: '🚀' } }],
    });
    expect(custom.getHTML()).toContain('data-emoji="🚀"');
    expect(custom.getHTML()).toContain('🚀');

    const empty = createEditor({ type: 'doc', content: [{ type: 'emoji' }] });
    expect(empty.getHTML()).toContain('⭐');
  });
});

describe('page, database and breadcrumb blocks: renderHTML', () => {
  it('renders a sub-page with title, icon and page id', () => {
    const current = createEditor({
      type: 'doc',
      content: [{ type: 'subPage', attrs: { pageId: 'page-1', title: 'Spec', icon: '📐' } }],
    });
    const html = current.getHTML();

    expect(html).toContain('data-block-type="page"');
    expect(html).toContain('data-page-id="page-1"');
    expect(html).toContain('data-title="Spec"');
    expect(html).toContain('📐');
    expect(html).toContain('Spec');
  });

  it('labels an untitled page and a page still being created', () => {
    const untitled = createEditor({
      type: 'doc',
      content: [{ type: 'subPage', attrs: { pageId: 'page-1', title: '' } }],
    });
    expect(untitled.getHTML()).toContain('Untitled');
    expect(untitled.getHTML()).toContain('📄');

    const pending = createEditor({
      type: 'doc',
      content: [{ type: 'subPage', attrs: { pageId: null, title: '' } }],
    });
    expect(pending.getHTML()).toContain('Creating page…');
    expect(pending.getHTML()).not.toContain('data-page-id');
  });

  it('uses English labels when the document language is English', () => {
    document.documentElement.lang = 'en';

    const untitled = createEditor({
      type: 'doc',
      content: [{ type: 'subPage', attrs: { pageId: 'page-1', title: '' } }],
    });
    expect(untitled.getHTML()).toContain('Untitled');

    const pending = createEditor({
      type: 'doc',
      content: [{ type: 'subPage', attrs: { pageId: '', title: '' } }],
    });
    expect(pending.getHTML()).toContain('Creating page…');
  });

  it('renders page links with and without a target', () => {
    const linked = createEditor({
      type: 'doc',
      content: [{ type: 'pageLink', attrs: { pageId: 'page-2' } }],
    });
    expect(linked.getHTML()).toContain('data-block-type="linkToPage"');
    expect(linked.getHTML()).toContain('data-page-id="page-2"');
    expect(linked.getHTML()).toContain('Page');

    const empty = createEditor({ type: 'doc', content: [{ type: 'pageLink' }] });
    expect(empty.getHTML()).toContain('data-page-id=""');
    expect(empty.getHTML()).toContain('Pick a page…');
  });

  it('renders an inline database with and without ids, and a database link', () => {
    const filled = createEditor({
      type: 'doc',
      content: [
        { type: 'databaseBlock', attrs: { databaseId: 'db-1', viewId: 'view-1' } },
        { type: 'databaseLink', attrs: { databaseId: 'db-2' } },
      ],
    });
    const html = filled.getHTML();

    expect(html).toContain('data-database-id="db-1"');
    expect(html).toContain('data-view-id="view-1"');
    expect(html).toContain('data-block-type="databaseLink"');
    expect(html).toContain('Database');

    const empty = createEditor({ type: 'doc', content: [{ type: 'databaseBlock' }] });
    expect(empty.getHTML()).not.toContain('data-database-id');
    expect(empty.getHTML()).not.toContain('data-view-id');
  });

  it('renders breadcrumbs and equations', () => {
    const current = createEditor({
      type: 'doc',
      content: [
        { type: 'breadcrumbBlock' },
        { type: 'equationBlock', attrs: { expression: 'x^2' } },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            { type: 'inlineMath', attrs: { expression: 'a+b' } },
          ],
        },
      ],
    });
    const html = current.getHTML();

    expect(html).toContain('data-block-type="breadcrumb"');
    expect(html).toContain('data-expression="x^2"');
    expect(html).toContain('data-inline-math');
    expect(html).toContain('data-expression="a+b"');
    expect(html).toContain('a+b');
  });

  it('renders columns with nested content', () => {
    const current = createEditor({
      type: 'doc',
      content: [
        {
          type: 'columnsList',
          content: [
            { type: 'columnsColumn', content: [paragraph('Left')] },
            { type: 'columnsColumn', content: [paragraph('Right')] },
          ],
        },
      ],
    });
    const html = current.getHTML();

    expect(html).toContain('data-block-type="columns"');
    expect(html).toContain('data-column');
    expect(html).toContain('Left');
    expect(html).toContain('Right');
  });
});

describe('tables: geometry attributes', () => {
  it('keeps column widths and row heights in the rendered HTML', () => {
    const current = createEditor({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              attrs: { rowHeight: 64 },
              content: [
                {
                  type: 'tableHeader',
                  attrs: { colwidth: [120] },
                  content: [paragraph('Header')],
                },
                {
                  type: 'tableCell',
                  attrs: { colwidth: [160] },
                  content: [paragraph('Cell')],
                },
              ],
            },
          ],
        },
      ],
    });

    const html = current.getHTML();

    expect(html).toContain('data-row-height="64"');
    expect(html).toContain('colwidth="120"');
    expect(html).toContain('colwidth="160"');
  });
});

describe('parseHTML round-trip', () => {
  it('restores media, page and database attributes from markup', () => {
    const current = createEditor({
      type: 'doc',
      content: [
        {
          type: 'image',
          attrs: { fileId: 'file-9', caption: 'Pic', width: 40, fullWidth: false },
        },
        { type: 'file', attrs: { name: 'notes.txt', sizeBytes: 10 } },
        { type: 'emoji', attrs: { emoji: '🎯' } },
        { type: 'subPage', attrs: { pageId: 'page-9', title: 'Child', icon: '🧩' } },
        { type: 'pageLink', attrs: { pageId: 'page-10' } },
        { type: 'databaseBlock', attrs: { databaseId: 'db-9', viewId: 'view-9' } },
        { type: 'equationBlock', attrs: { expression: 'y = x' } },
      ],
    });

    const html = current.getHTML();

    const restored = createEditor(html);
    const json = JSON.stringify(restored.getJSON());

    // Media file ids and captions are not part of the current fallback markup;
    // the width and the custom blocks do round-trip.
    expect(json).toContain('"width":40');
    expect(json).toContain('"name":"notes.txt"');
    expect(json).toContain('"emoji":"🎯"');
    expect(json).toContain('"pageId":"page-9"');
    expect(json).toContain('"pageId":"page-10"');
    expect(json).toContain('"databaseId":"db-9"');
    expect(json).toContain('"viewId":"view-9"');
    expect(json).toContain('"expression":"y = x"');
  });
});
