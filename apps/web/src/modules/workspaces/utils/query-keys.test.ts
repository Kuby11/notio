import { describe, expect, it } from 'vitest';
import { workspaceKeys } from './query-keys';

describe('workspaceKeys', () => {
  it('держит список под корнем рабочих пространств', () => {
    expect(workspaceKeys.list()).toEqual([...workspaceKeys.all, 'list']);
  });

  it('различает workspace в деталях, участниках и приглашениях', () => {
    expect(workspaceKeys.detail('ws-1')).toEqual([...workspaceKeys.all, 'detail', 'ws-1']);
    expect(workspaceKeys.members('ws-1')).toEqual([...workspaceKeys.all, 'members', 'ws-1']);
    expect(workspaceKeys.invitations('ws-1')).toEqual([
      ...workspaceKeys.all,
      'invitations',
      'ws-1',
    ]);
  });

  it('не смешивает выключенный запрос участников с настоящим workspace', () => {
    expect(workspaceKeys.members(null)).not.toEqual(workspaceKeys.members('ws-1'));
  });
});
