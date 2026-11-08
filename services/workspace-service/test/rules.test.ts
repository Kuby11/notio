import { describe, expect, it } from 'vitest';
import { createInvitationToken, slugify } from '../src/services/workspace.service';

describe('slugify', () => {
  it('transliterates Cyrillic', () => {
    expect(slugify('Моя работа')).toBe('moya-rabota');
  });

  it('keeps latin letters and digits and collapses separators', () => {
    expect(slugify('Notion  Clone — 2026')).toBe('notion-clone-2026');
  });

  it('falls back to a default name when no slug characters remain', () => {
    expect(slugify('???')).toBe('workspace');
  });

  it('limits the length so the URL stays readable', () => {
    expect(slugify('а'.repeat(80))).toHaveLength(48);
  });
});

describe('createInvitationToken', () => {
  it('returns 32 bytes in hex and never repeats', () => {
    const first = createInvitationToken();
    const second = createInvitationToken();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });
});
