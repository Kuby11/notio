import { describe, expect, it } from 'vitest';
import { editorKeys } from './query-keys';

describe('editorKeys', () => {
  it('держит документ под корнем страницы', () => {
    expect(editorKeys.all('page-1')).toEqual([...editorKeys.root, 'page-1']);
    expect(editorKeys.document('page-1')).toEqual([...editorKeys.all('page-1'), 'document']);
  });

  it('различает документы разных страниц', () => {
    expect(editorKeys.document('page-1')).not.toEqual(editorKeys.document('page-2'));
  });
});
