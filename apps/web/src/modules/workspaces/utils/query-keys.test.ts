import { describe, expect, it } from 'vitest';
import { workspaceKeys } from './query-keys';

describe('workspaceKeys', () => {
  it('keeps the list under the workspaces root', () => {
    expect(workspaceKeys.list()).toEqual([...workspaceKeys.all, 'list']);
  });

  it('distinguishes a workspace in details, members, and invitations', () => {
    expect(workspaceKeys.detail('ws-1')).toEqual([...workspaceKeys.all, 'detail', 'ws-1']);
    expect(workspaceKeys.members('ws-1')).toEqual([...workspaceKeys.all, 'members', 'ws-1']);
    expect(workspaceKeys.invitations('ws-1')).toEqual([
      ...workspaceKeys.all,
      'invitations',
      'ws-1',
    ]);
  });

  it('does not mix the disabled members query with a real workspace', () => {
    expect(workspaceKeys.members(null)).not.toEqual(workspaceKeys.members('ws-1'));
  });
});
