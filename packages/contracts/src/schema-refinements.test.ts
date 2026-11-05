import { describe, expect, it } from 'vitest';
import { RichTextSchema, UpdateBlockInputSchema } from './block';
import { HttpUrlSchema } from './ids';
import { UpdateWorkspaceInputSchema } from './workspace';

describe('UpdateBlockInputSchema', () => {
  it('rejects an empty update', () => {
    expect(UpdateBlockInputSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a content-only or type-only update', () => {
    expect(UpdateBlockInputSchema.safeParse({ type: 'paragraph' }).success).toBe(true);
    expect(
      UpdateBlockInputSchema.safeParse({
        content: { type: 'paragraph', content: 'hello' },
      }).success,
    ).toBe(true);
  });
});

describe('RichTextSchema', () => {
  it('accepts legacy plain strings', () => {
    expect(RichTextSchema.parse('plain text')).toBe('plain text');
  });

  it('accepts every inline mark and math segments', () => {
    const segments = [
      { text: 'bold', marks: [{ type: 'bold' }] },
      { text: 'italic', marks: [{ type: 'italic' }] },
      { text: 'strike', marks: [{ type: 'strike' }] },
      { text: 'code', marks: [{ type: 'code' }] },
      { text: 'link', marks: [{ type: 'link', href: 'https://example.com' }] },
      { text: 'colour', marks: [{ type: 'color', color: 'red' }] },
      { text: 'fill', marks: [{ type: 'backgroundColor', color: 'yellow' }] },
      { text: 'plain' },
      { math: 'x^2' },
    ];

    expect(RichTextSchema.parse(segments)).toEqual(segments);
  });

  it('rejects unsafe links and unknown marks', () => {
    expect(
      RichTextSchema.safeParse([{ text: 'x', marks: [{ type: 'link', href: 'javascript:1' }] }])
        .success,
    ).toBe(false);
    expect(RichTextSchema.safeParse([{ text: 'x', marks: [{ type: 'underline' }] }]).success).toBe(
      false,
    );
    expect(
      RichTextSchema.safeParse([{ text: 'x', marks: [{ type: 'color', color: 'chartreuse' }] }])
        .success,
    ).toBe(false);
    expect(RichTextSchema.safeParse([{ text: '', extra: true }]).success).toBe(false);
  });
});

describe('HttpUrlSchema', () => {
  it('accepts http and https links', () => {
    expect(HttpUrlSchema.safeParse('http://example.com').success).toBe(true);
    expect(HttpUrlSchema.safeParse('https://example.com/path?q=1').success).toBe(true);
  });

  it('rejects other protocols and malformed values', () => {
    expect(HttpUrlSchema.safeParse('ftp://example.com').success).toBe(false);
    expect(HttpUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
    expect(HttpUrlSchema.safeParse('not a url').success).toBe(false);
  });
});

describe('UpdateWorkspaceInputSchema', () => {
  it('rejects an empty update', () => {
    expect(UpdateWorkspaceInputSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a single field', () => {
    expect(UpdateWorkspaceInputSchema.safeParse({ name: 'Renamed' }).success).toBe(true);
    expect(UpdateWorkspaceInputSchema.safeParse({ icon: null }).success).toBe(true);
  });
});
