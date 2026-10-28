import { describe, expect, it } from 'vitest';
import { pageKeys } from './query-keys';

describe('pageKeys', () => {
  it('keeps tree levels inside workspace root', () => {
    expect(pageKeys.children('ws-1', null)).toEqual([...pageKeys.all('ws-1'), 'children', null]);
    expect(pageKeys.children('ws-1', 'page-1')).not.toEqual(pageKeys.children('ws-1', 'page-2'));
  });

  it('keeps page detail under same root', () => {
    expect(pageKeys.detail('ws-1', 'page-1')).toEqual([
      ...pageKeys.all('ws-1'),
      'detail',
      'page-1',
    ]);
  });

  it('keeps favorites separate from tree levels', () => {
    expect(pageKeys.favorites('ws-1')).toEqual([...pageKeys.all('ws-1'), 'favorites']);
    expect(pageKeys.favorites('ws-1')).not.toEqual(pageKeys.children('ws-1', null));
  });

  it('keeps trash under the same root but separate from favorites', () => {
    expect(pageKeys.trash('ws-1')).toEqual([...pageKeys.all('ws-1'), 'trash']);
    expect(pageKeys.trash('ws-1')).not.toEqual(pageKeys.favorites('ws-1'));
  });
});
