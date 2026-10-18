import { describe, expect, it } from 'vitest';
import { createInvitationToken, slugify } from '../src/services/workspace.service';

describe('slugify', () => {
  it('транслитерирует кириллицу', () => {
    expect(slugify('Моя работа')).toBe('moya-rabota');
  });

  it('оставляет латиницу и цифры, схлопывает разделители', () => {
    expect(slugify('Notion  Clone — 2026')).toBe('notion-clone-2026');
  });

  it('подставляет запасное имя, если символов для slug не осталось', () => {
    expect(slugify('???')).toBe('workspace');
  });

  it('ограничивает длину, чтобы адрес оставался читаемым', () => {
    expect(slugify('а'.repeat(80))).toHaveLength(48);
  });
});

describe('createInvitationToken', () => {
  it('возвращает 32 байта в hex и не повторяется', () => {
    const first = createInvitationToken();
    const second = createInvitationToken();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toBe(second);
  });
});
