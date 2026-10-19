import { describe, expect, it } from 'vitest';
import { pageKeys } from './query-keys';

describe('pageKeys', () => {
  it('держит уровни дерева внутри корня workspace', () => {
    expect(pageKeys.children('ws-1', null)).toEqual([...pageKeys.all('ws-1'), 'children', null]);
    expect(pageKeys.children('ws-1', 'page-1')).not.toEqual(pageKeys.children('ws-1', 'page-2'));
  });

  it('держит карточку страницы под тем же корнем', () => {
    expect(pageKeys.detail('ws-1', 'page-1')).toEqual([
      ...pageKeys.all('ws-1'),
      'detail',
      'page-1',
    ]);
  });

  it('держит избранное отдельно от уровней дерева', () => {
    expect(pageKeys.favorites('ws-1')).toEqual([...pageKeys.all('ws-1'), 'favorites']);
    expect(pageKeys.favorites('ws-1')).not.toEqual(pageKeys.children('ws-1', null));
  });

  it('держит корзину под тем же корнем, но отдельно от избранного', () => {
    expect(pageKeys.trash('ws-1')).toEqual([...pageKeys.all('ws-1'), 'trash']);
    expect(pageKeys.trash('ws-1')).not.toEqual(pageKeys.favorites('ws-1'));
  });
});
