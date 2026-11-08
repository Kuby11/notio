import { roleCan, WORKSPACE_PERMISSIONS, type WorkspaceRole } from '@notio/contracts';
import { describe, expect, it } from 'vitest';

/**
 * The permission matrix is written out explicitly rather than derived from the
 * code: otherwise the test would repeat the implementation and miss a wrong matrix.
 */
const EXPECTED: Record<WorkspaceRole, readonly WorkspacePermissionName[]> = {
  owner: [
    'workspace:read',
    'workspace:write',
    'workspace:archive',
    'member:manage',
    'invitation:manage',
    'page:read',
    'page:write',
  ],
  editor: ['workspace:read', 'page:read', 'page:write'],
  viewer: ['workspace:read', 'page:read'],
};

type WorkspacePermissionName = (typeof WORKSPACE_PERMISSIONS)[number];

describe('permission matrix', () => {
  it.each(Object.entries(EXPECTED))(
    'role %s gets exactly the listed permissions',
    (role, expected) => {
      const actual = WORKSPACE_PERMISSIONS.filter((permission) =>
        roleCan(role as WorkspaceRole, permission),
      );

      expect(actual).toEqual(expected);
    },
  );

  it('no role gets a permission that is not in the list', () => {
    const unknown = 'workspace:delete-everything' as WorkspacePermissionName;

    for (const role of ['owner', 'editor', 'viewer'] as const) {
      expect(roleCan(role, unknown)).toBe(false);
    }
  });

  it('editor cannot manage members or invitations', () => {
    expect(roleCan('editor', 'member:manage')).toBe(false);
    expect(roleCan('editor', 'invitation:manage')).toBe(false);
    expect(roleCan('editor', 'workspace:archive')).toBe(false);
  });

  it('viewer can only read', () => {
    expect(roleCan('viewer', 'workspace:write')).toBe(false);
    expect(roleCan('viewer', 'page:write')).toBe(false);
    expect(roleCan('viewer', 'workspace:read')).toBe(true);
  });
});
